"""
Attempt at a less ad-hoc module for manipulating domains, based around
manipulating an AST of sorts
"""

# NOTE: normalize_domain([]) -> [(1, '=', 1)] whereas reify(parse([])) -> ['&']
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

NODE_NEGATION = {'&': '|', '|': '&'}
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
    negation_stack = [(node, False)]
    zipper = []
    while negation_stack:
        node, negate = negation_stack.pop()
        op, *children = node

        if op == '!':
            [child] = children
            # process negatable child, otherwise shortcut (either strip or
            # keep the negation node depending on negate state / flag)
            if child[0] in NODE_NEGATION or child[0] in TERM_NEGATION:
                negation_stack.append((child, not negate))
            elif negate: # !(!(child)) -> child
                zipper.append((child, 0))
            else:
                zipper.append((node, 0))
            continue

        neg = NODE_NEGATION.get(op)
        if neg:
            for c in reversed(children):
                negation_stack.append((c, negate))
            zipper.append((neg if negate else op, len(children)))
            continue

        neg = TERM_NEGATION.get(op)
        if not negate:
            zipper.append((node, 0))
        elif neg:
            zipper.append(([neg, *children], 0))
        else:
            zipper.append((['!', node], 0))

    nodes = []
    for (n, count) in reversed(zipper):
        if count == 0:
            nodes.append(n)
        else:
            nodes.append([n, *(nodes.pop() for _ in range(count))])
    [root] = nodes
    return root
