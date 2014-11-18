Eventual consistency

-

you're building a dist sys
either because of scale or arch...
nodes are not able to sync in real time

-

to give good performance, nodes act on their own...
then reconcile state with each other

this is called "eventual consistency"

-

the sign of EC: are changes allowed...
without the nodes talking to each other first?
"concurrent changes"

if so, you need...

-

"convergence"
nodes must come to the same state
regardless of the order they receive information

-

example: git

-

example: twitter
"manhattan db"

-

example: google docs

-

this talk: a survey of strategies for EC

-

first: read repair
read repair is a syncing strategy
before or after read, a digest is sent to other nodes
detects stale entries in nodes which triggers updates

-

now: convergence!
two nodes make concurrent changes
how do we reconcile them?

-

operational transforms
1. apply operations locally
2. replicate the operations to all other nodes
3. transform received operations to maintain intent

-

OT example:
given a string "abc", two operations at two nodes
  O1: insert "x" at position 0
  O2: delete char at position 2 ("c")

if O2, then O1: you get "xab"
if O1, then O2: you get "xac"

-

to maintain intent, 
  if O1, then O2,
  O2 must be transformed

O2 = delete(2)
O2' = delete(3)

-

lots of different OT algorithms
all track the partial order of ops
sequential ops apply as-received
concurrent ops must be transformed

-

OT common semantics
documents: ordered list of characters
3 operations: insert, update, delete

or you can define your own

-

While the classic OT approach of defining operations through their
 offsets in the text seems to be simple and natural, real-world
 distributed systems raise serious issues. Namely, that operations
 propagate with finite speed, states of participants are often different,
 thus the resulting combinations of states and operations are extremely
 hard to foresee and understand.

-

Joseph Gentle, an ex Google Wave engineer and an author of the Share.JS
 library, wrote: Unfortunately, implementing OT sucks. There's a million
 algorithms with different tradeoffs, mostly trapped in academic papers.
 The algorithms are really hard and time consuming to implement correctly.
 ... Wave took 2 years to write and if we rewrote it today, it would take 
 almost as long to write a second time.

-

The correctness problems of OT led to introduction of transformationless 
 post-OT schemes, such as WOOT, Logoot and Causal Trees (CT).
"Post-OT" schemes decompose the document into atomic operations, but they 
 workaround the need to transform operations by employing a combination of
 unique symbol identifiers, vector timestamps and/or tombstones.

-

rather than try to preserve intent of ops
use data semantics which cant conflict

-

but how?
let's explore some properties

-

monotonic
in math: a function on an ordered set which preserves order

monotonically increasing:
  if x <= y
  then f(x) <= f(y)

-

example graphs

  *please refer to whiteboard*

-

a monotonic data type
  type's values are ordered
  operations preserve order
  f(Obj) >= Obj

  - an int where `++` is the only op
  - the levels in super mario

-

join-semilattice
  a partially ordered set
  has a join operation, "least upper bound"
  
  LUB(x,y) =
  - the least element of the semilattice
  - which is >= both x and y

-

example
given this set of partially ordered tuples:
  {0,0} < {1,0} | {0,1} < {1,1}

  join({0,0}, {1,0}) = {1,0}
  join({0,0}, {0,1}) = {0,1}
  join({1,0}, {0,1}) = {1,1}

"least element":
  {1,1} > {0,1} > {0,0}, but...
  join({0,0}, {0,1}) != {1,1}

-

CRDTs
monotonic semilattice data types
"conflict free" - always merge determinstically

-

monotonic?

you know that the other nodes are never going to "back-track"
if you have a counter, and the node Bob says...
"4, 5, 6, 7, 4"

you say, "7 then 4? No way, that's old"
"value is still 7"

because it's monotonic

-

semilattice?

if you have concurrent changes...
and, thus, divergent state...
you know how to reconcile it

you use the least upper bound

-

this is great for EC...
because it's order independent!

thus intent is preserved

-

lets look at some CRDTs

-

idempotence is a CRDT
  two states: 0 < 1
  join(0,0) = 0
  join(0,1) = 1
  join(1,1) = 1

  one op: apply
  apply(0) = 1
  apply(1) = 1

-

the growset CRDT
  a set where state only grows
  join(S1, S2) = union(S1, S2)
  join({a,b}, {c}) = {a,b,c}
  join({a,b,c}, {c}) = {a,b,c}

  one op: add
  add({a,b}, c) = {a,b,c}
  add({a,b,c}, c) = {a,b,c}

-

"reversable" is a CRDT
  three states: 0 < 1 < t
  join(0,1) = 1
  join(1,t) = t
  join(0,t) = t

  two ops: apply, unapply
  apply(0)   = 1
  apply(1)   = 1
  unapply(1) = t
  unapply(0) = t

-

the 2P-set CRDT
  a set where elements can be removed...
  ...but never re-added
  uses two growsets: elements and tombstones

  join(S1, S2) = [
    join(S1.elements,   S2.elements),
    join(S1.tombstones, S2.tombstones)
  ]

  two ops: add, remove
  add(S, x)    = add(S.elements, x)
  remove(S, x) = add(S.tombstones, x)

  value = S.elements - S.tombstones

-

now we're looking at CRDT meta-data

-

the observed-remove set CRDT
  a set where elements can freely add and remove
  each element is tagged with a unique id

  join(S1, S2) = [
    join(S1.element-tags,   S2.element-tags),
    join(S1.tombstone-tags, S2.tombstone-tags)
  ]

  two ops: add, remove
  add(S, x)    = add(S.element-tags, x ++ gen_tag())
  remove(S, x) = join(S.tombstone-tags, find(S.element-tags, x))

  value = unique(S.element-tags - S.tombstone-tags)

-

the 2P2P-graph CRDT
  a graph of vertices connected by edges
  implemented as two 2P sets

  invariant: edges must have corresponding vertices
  what if there's concurrent addEdge & removeVertex?
    removeVertex wins

-

add-only monotonic DAGs
  global invariants are difficult
  maintaining a shape (eg DAG or tree) usually requires sync

  only works if 1) edges cant be removed
  and 2) you only strengthen existing edges

  OK:  {(1,2), (2,3)} + (1,3)
  BAD: {(1,2), (2,3)} + (3,1)
  BAD: {(1,2), (2,3)} + (3,4) <-- can you guess why?

-

add-remove partial-order CRDT
  a DAG with transitive edges (partial order)
  therefore can handle removes

  vertices: 2P-set of values
  edges: Growset of {prev, value, next}

-

we're almost ready to replace OT!

we just need a total order
  how? tag elements in the partial-order CRDT...
  with `timestamp ++ node-id`

  concurrent adds now have decideable order!
  