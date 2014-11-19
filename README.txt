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
  A: insert "x" at position 0
  B: delete char at position 2 ("c")

if del(2), then ins(x,0): you get "xab"
if ins(x,0), then del(2): you get "xac"

-

to maintain intent, 
  if ins(x,0) is executed before del(2)
  del(2) must be transformed

  del(2)     -> del(3)
  delete 'b' -> delete 'c'

"xabc"...
  del(2), ins(x,0) = "xab"
  ins(x,0), del(3) = "xab"

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

  two ops: apply, rollback
  apply(0)   = 1
  apply(1)   = 1
  apply(t)   = t
  rollback(0) = t
  rollback(1) = t
  rollback(t) = t

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

ok, what about ordered values?

-

the 2P2P-graph CRDT
  a graph of vertices connected by edges
  implemented as two 2P sets

  invariant: edges must have corresponding vertices
  what if there's concurrent addEdge & removeVertex?
    removeVertex wins

-

how about a directed-acyclic graph?

bad news:
  global invariants are difficult
  maintaining a shape (eg DAG or tree) usually requires sync

so we'll need some constraints

-

add-only monotonic DAGs
  
  only works if 1) edges cant be removed
  and 2) you only strengthen existing edges

  OK:  {(1,2), (2,3)} + (1,3)
  BAD: {(1,2), (2,3)} + (3,1)
  BAD: {(1,2), (2,3)} + (3,4) <-- can you guess why?

  (note to self: use whiteboard)

-

how is that useful?

-

add-remove partial-order set CRDT

think of as a DAG...
  ...partial order means edges are transitive
  ...transitive means the gaps will "self-heal"
  ...which means removes are ok!

  vertices: 2P-set of values
  edges: Growset of {prev, value, next}

-

we're almost ready to replace OT!

-

what's missing?

total order!

  it's
  "hello world"
  not
  " edhllloorw"

-

how do we get total order?

one solution:
  tag elements in the partial-order set CRDT...
  ...with `timestamp ++ node-id`

  a(9am) < b(10am) < b(11am) < c(9am)

  concurrent adds now have decideable order!

-

in your face, OT

-

what other CRDTs are there?

-

registers

  not very fun: you use a clock...
  ...and say "last writer wins"

  bob   sets X to "foo" at 5pm
  alice sets X to "bar" at 6pm
  sync...
  X = "bar"

-

maps

  kind of like sets + registers...

  each element in the set is a tuple
  {key, value}

  if you have two valid values for a given key...
  last-writer wins

-

counters

  a vector of counters...
  ...one counter for each node
  ...current value = sum of them

-

counters that can decrement

  two vectors of counters...
  ...the "inc" vector and the "dec" vector
  ...one counter in each vector for each node
  ...current value = sum of incs - sum of decs

-

starting to get a feel for it?

-

let's talk overhead

-

so far, we've been shipping state
  and the state can get fat

  think of the OR-Set
  ...all those tombstones!

-

alternative: state-delta shipping

  rather than ship the whole state...
  ...ship state deltas which also merge

  and ship the whole state occasionally too

-

delta-shipping a state-based counter

  delta's only ship the node's own dimension in the vector

               a,b,c,d 
  full state: [5,6,5,2]
  delta:       b=6
  delta:       b=7
  delta:       b=8
  delta:       b=9
  full state: [5,9,5,2]

-

alternative: operation-based CRDTS

  rather than ship state, ship the ops
  requirement: guaranteed causal delivery

-

In op-based CRDTs, representations of operations issued at each
node are reliably broadcast to all replicas. Once all replicas
receive all issued operations (on all nodes), they eventually
converge to a single state, if:

  (a) operations are broadcast via a reliable causal broadcast, and
  (b) 'applying' representations of concurrently issued operations
      is commutative.

-

Op-based CRDTs can often have a simple and compact state since
they can rely on the exactly-once delivery properties of the
broadcast service, and thus do not have to explicitly handle
non-idempotent operations.

-

ops-shipping an OR-Set

  rather than ship entire element & tombstone set...
  ...ship add(element, tag) and remove(tags)

  commutative:
    add+add = add+add
    rem+rem = rem+rem
  not commutaive:
    add+rem != rem+add

  but...
    because of causal ordering,
    this can still work

    in fact, it lets us ditch the tombstone set!

-

causal ordering?
  an operation that depends on a previous operation...
  ...will arrive after its dependency

  eg removes show up after adds

how? one way:
  if you guarantee message-order from a node
  and nodes rebroadcast ops they depend on
  then you get causal order

-

how? another way:
  "Tagged Reliable Causal Broadcast"

  use partial-order: the "happens-before" relation
  if a "happens-before" dep is not yet met, buffer until it is

-

Unlike totally ordered broadcast, which requires a global consensus
on the delivery order, causal broadcast can progress with local decisions.
For general datatypes, causal consistency is likely the strongest
consistency criteria compatible with an always-available system that
eventually converges

-

now we dont need tombstones!

  add(tag123, 'a')
  remove(tag123)
  ^ just remove 'tag123' from the elements

  remove(tag123)
  add(tag123, 'a')
  ^ cant happen
  why? we have causal ordering
  the 'add' would have been rebroadcast by the node that did
    the 'remove'

-

great! getting pretty efficient

what if we want total order?

-

oh shit

-

the totally-order list relied on tombstones
  remember the transitive "partial-order" edges?
  we need the tombstones to "transit"

-

ok, so let's say we:

  keep doing ops-shipping
  keep doing causal ordering

  and create a totally-ordered ID-space which is infinitely divisible?

  therefore removing the need for tombstones to keep track of order

-

logoot

  ordered set
  no tombstones

  based on non-mutable and totally ordered position IDs
  which are in a continuous space
  meaning, for two ids A and B...
  ...we can always find an id C which is between them (A < C < B)

-

how?

  a list of integers

  if...
  A = 0
  B = 1
  
  then...
  C = 0,1

  and we say...
  0 < {0,1} < 1

-

to avoid conflicts,
use node IDs during generation

-

totally ordered
no tombstones
ships operations

now that's webscale

-

questions?