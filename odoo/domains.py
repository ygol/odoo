"""
Attempt at a less ad-hoc module for manipulating domains, based around
manipulating an AST of sorts
"""

# NOTE: normalize_domain([]) -> [(1, '=', 1)] whereas reify(parse([])) -> ['&']

# abstract operations:
# * is_branch (ok)
# * children (ok)
# * make_node
# * create loc ~ type(self)(...) instead of hard-coded Loc (opt: `clone` method w/ same params as ctor?)
# * maybe use placeholders other than None?
class Loc:
    def __init__(self, node_or_loc, *, node=None, lefts=None, rights=None, path=None, changed=None, end=None):
        if isinstance(node_or_loc, Loc):
            loc = node_or_loc
            node = loc.node if node is None else node
            lefts = loc.lefts if lefts is None else lefts
            rights = loc.rights if rights is None else rights
            path = loc.path if path is None else path
            changed = loc.changed if changed is None else changed
            end = loc.end if end is None else False
        else:
            if node:
                raise TypeError("Got two paraneters for node: %s and %s", node_or_loc, node)
            node = node_or_loc

        if not node:
            raise TypeError("A loc must have a node")
        # node, lefts and rights is laid out such that parent.children = lefts + [node] + rights
        self.node = node
        self.is_branch = self.node[0] in '|&!'
        self.lefts = lefts
        self.rights = rights
        self.path = path
        self.changed = changed or False
        self.end = end or False

    @property
    def children(self):
        """ Node's children, raises an error if the current node can't have children.
        """
        if self.is_branch:
            return self.node[1:]
        raise ValueError("children() called on leaf node %s" % self.node)

    def next(self):
        """ Moves to the next loc in depth-first traversal order.

        Once reaching the end of the traversal, returns a placeholder loc
        recognisable via the `.end` predicate.

        If already at the end, stays there.

        :rtype: Loc
        """
        if self.end:
            return self

        loc = self.is_branch and self.down()
        if loc:
            return loc

        return self.skip()

    def skip(self):
        """ Moves to the next loc in DFS, except skipping the current node's
        children.

        Once reaching the end of the traversal, returns a placeholder loc
        regonisable via the `.end` predicate.

        If already at the end, stay there.

        :rtype: Loc
        """
        if self.end:
            return self

        loc = self.right()
        if loc:
            return loc

        loc = self
        while True:
            parent = loc.up()
            if not parent:
                return Loc(loc.node, end=True)  # loc is completely empty by design

            right = parent.right()
            if right:
                return right
            loc = parent

    def prev(self):
        loc = self.left()
        if not loc:
            return self.up()

        while True:
            child = loc.down()
            if child:
                loc = child.rightmost()
            else:
                return loc

    def left(self):
        """
        :return: the loc of the left sibling of this loc's node, or None
        :rtype: Loc or None
        """
        if self.lefts:
            return Loc(self, node=self.lefts[-1], lefts=self.lefts[:-1], rights=[self.node] + self.rights)

    def leftmost(self):
        """
        :return: the left-most sibling of self, or self if it's the left-most
        :rtype: Loc
        """
        lefts = self.lefts
        if not lefts:
            return self

        return Loc(
            self,
            node=lefts[0],
            lefts=[],
            rights=lefts[1:] + [self.node] + self.rights
        )

    def right(self):
        """
        :returns: the loc of the right sibling of this loc's node, or None
        :rtype: Loc or None
        """
        if self.rights:
            return Loc(self, node=self.rights[0], lefts=self.lefts + [self.node], rights=self.rights[1:])

    def rightmost(self):
        """
        :return: the right-most sibling of self, or self if it's the rightmost
        :rtype: Loc
        """
        rights = self.rights
        if not rights:
            return self

        return Loc(
            self,
            node=rights[-1],
            lefts=self.lefts + [self.node] + rights[:-1],
            rights=[]
        )

    def root(self):
        """ Zips all the way up and returns the root node

        :rtype: Loc
        """
        if self.end:
            return self.node

        loc = self
        while True:
            up = loc.up()
            if up:
                loc = up
            else:
                break
        return loc.node

    def up(self):
        """
        :return: loc of the parent of this loc's node, or None if at the top
        :rtype: Loc or None
        """
        parent = self.path
        if not parent:
            return None

        if not self.changed:
            return parent

        return Loc(parent, node=[parent.node[0], *self.lefts, self.node, *self.rights], changed=True)

    def down(self):
        """
        :returns: loc of the leftmost child of this loc's node, or None if no children
        :rtype: Loc or None
        """
        if self.is_branch and self.children:
            return Loc(self.children[0], lefts=[], rights=self.children[1:], path=self)

    def replace(self, node):
        """ Replaces the node at this loc, without moving
        """
        return Loc(self, node=node, changed=True)

def zipper(node):
    return Loc(node)

def parse(domain):
    """ Parses a domain to a simple tree representation where all nodes are
    prefix-notation lists (operator followed by any number of operands):

    * leaves are binary `[op, v1, v2]`
    * NOT is a unary `['!', v]`
    * other logical operators are n-ary with n >= 2 `[op, v1, v2, *vs]`
    """
    stack = []
    for node in reversed(domain):
        if node == '!':
            stack.append(['!', stack.pop()])
        elif node == '&' or node == '|':
            arg1, arg2 = stack.pop(), stack.pop()
            arg1 = arg1[1:] if arg1[0] == node else [arg1]
            arg2 = arg2[1:] if arg2[0] == node else [arg2]
            stack.append([node, *arg1, *arg2])
        else:
            left, op, right = node
            stack.append([op, left, right])

    if len(stack) == 1:
        return stack[0]

    t = ['&']
    for node in reversed(stack):
        if node[0] == '&':
            t.extend(node[1:])
        else:
            t.append(node)
    return t

def reify(tree):
    to_process = [tree]
    domain = []
    while to_process:
        op, *children = to_process.pop()
        if op == '!':
            domain.append(op)
            to_process.extend(children)
        elif op in '&|':
            domain.extend([op] * (len(children) - 1))
            to_process.extend(reversed(children))
        else:
            domain.append((children[0], op, children[1]))
    return domain

LOGICAL_NEGATION = {'&': '|', '|': '&'}
TERM_NEGATION = {
    '<': '>=',
    '>': '<=',
    '<=': '>',
    '>=': '<',
    '=': '!=',
    '!=': '=',
    'in': 'not in',
    'like': 'not like',
    'ilike': 'not ilike',
    'not in': 'in',
    'not like': 'like',
    'not ilike': 'ilike',
}

def distribute_not(node):
    """ Looks for negation nodes and distributes them to their children
    """
    loc = Loc(node)
    while not loc.end:
        # we only care for negation nodes
        if loc.node[0] != '!':
            loc = loc.next()
            continue

        [child] = loc.node[1:]
        # if the child can be negated, replace the current node by the
        # child's negation
        if child[0] in LOGICAL_NEGATION or child[0] in TERM_NEGATION:
            loc = loc.replace(_negate(child))
        # skip subtree regardless, we've either processed it entirely
        # (e.g. (! (& a b)) -> (| (!a) (!b)) or have nothing to process
        # (e.g. (! (child_of a b)) -> (! (child_of a b))
        loc = loc.skip()
    return loc.node

def _negate(node):
    """ Returns a negated version of this tree
    """
    loc = Loc(node)
    while not loc.end:
        # a negation node is straight replaced by its child (processed)
        op = loc.node[0]
        if op == '!':
            loc = loc.replace(distribute_not(loc.node[1])).skip()
        elif op in LOGICAL_NEGATION:
            # replace by new node with same children & inverse logical operator
            loc = loc.replace([LOGICAL_NEGATION[op], *loc.node[1:]]).next()
        elif op in TERM_NEGATION:
            loc = loc.replace([TERM_NEGATION[op], *loc.node[1:]]).next()
        else:
            loc = loc.replace(['!', loc.node]).skip()
    return loc.node

def is_false(node):
    """ Returns whether the tree is always false(y) based on constant
    propagation?
    """
    return constant_propagation(node) is False

# maybe this could be part of normal parsing?
def constant_propagation(node):
    loc = Loc(node, end=True)
    # loop until we're back at the root, but at the start
    while True:
        prev, loc = loc, loc.prev()
        if not loc:
            return prev.node

        if loc.node == ['=', 1, 1] or (loc.node[0] == 'not in' and not loc.node[2]):
            loc = loc.replace(True)
        elif loc.node == ['=', 0, 1] or (loc.node[0] == 'in' and not loc.node[2]):
            loc = loc.replace(False)
        elif loc.node[0] == '!' and loc.node[1] in (True, False):
            loc = loc.replace(not loc.node[1])
        elif loc.node[0] == '&':
            if any(n is False for n in loc.node[1:]):
                loc = loc.replace(False)
            elif all(n is True for n in loc.node[1:]):
                loc = loc.replace(True)
        elif loc.node[0] == '|':
            if any(n is True for n in loc.node[1:]):
                loc = loc.replace(True)
            elif all(n is False for n in loc.node[1:]):
                loc = loc.replace(False)
