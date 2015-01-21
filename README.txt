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

convergence

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
  has a join operation called LUB

  "least upper bound"
  
  LUB( x, y ) =
  - the least element of the semilattice
  - which is >= both x and y

-

example
given A,B,C,D, where:

  A < B 
  A < C
  B < D
  C < D

    B
   / \
  A   D
   \ /
    C

  LUB( A, B ) = B
  LUB( A, C ) = C
  LUB( B, C ) = D

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

idempotence is monotoic
  two states: 0 < 1
  LUB( 0, 0 ) = 0
  LUB( 0, 1 ) = 1
  LUB( 1, 1 ) = 1

  one op: apply
  apply( 0 ) = 1
  apply( 1 ) = 1

-

the growset CRDT
  a set where state only grows
  LUB( S1, S2 )       = union( S1, S2 )
  LUB( [a,b], [c] )   = [a,b,c]
  LUB( [a,b,c], [c] ) = [a,b,c]

  one op: add
  add( [a,b], c ) = [a,b,c]
  add( [a,b,c], c ) = [a,b,c]

-

"reversable" is monotonic
  three states: 0 < 1 < t
  LUB( 0, 1 ) = 1
  LUB( 1, t ) = t
  LUB( 0, t ) = t

  two ops: apply, rollback
  apply( 0 )    = 1
  apply( 1 )    = 1
  apply( t )    = t
  rollback( 0 ) = t
  rollback( 1 ) = t
  rollback( t ) = t

-

the 2P-set CRDT
  a set where elements can be removed...
  ...but never re-added
  uses two growsets: elements and tombstones

  LUB( S1, S2 ) = [
    LUB( S1.elements,   S2.elements ),
    LUB( S1.tombstones, S2.tombstones )
  ]

  two ops: add, remove
     add( S, x ) = add( S.elements,   x )
  remove( S, x ) = add( S.tombstones, x )

  value = S.elements - S.tombstones

-

now we're looking at CRDT meta-data

-

the observed-remove set CRDT
  a set where elements can freely add and remove
  each element is tagged with a unique id

  LUB(S1, S2) = [
    LUB( S1.element-tags,   S2.element-tags ),
    LUB( S1.tombstone-tags, S2.tombstone-tags )
  ]

  two ops: add, remove
  add( S, x )    = add( S.element-tags,   x ++ gen_tag() )
  remove( S, x ) = add( S.tombstone-tags, findTagsOf( x ) )

  value = unique(S.element-tags - S.tombstone-tags)

-

what else is there?

-

register CRDT

  "last writer wins (LWW)"

  not very fun
    you use a clock
    (eg lamport clock)
    and take the last write

  bob   sets X to "foo" at seq:5
  alice sets X to "bar" at seq:6
  sync...
  X = "bar"

-

register CRDT

  "multi value (MV)"

  use a vector clock
  when neither vector-stamp dominates
    use both values

  bob   sets X to "foo" at [5,6]
  alice sets X to "bar" at [6,5]
  sync...
  x = "foo" & "bar"

  (couch db)

-

map CRDT

  kind of like sets + registers...

  each element in the set is a tuple
  (key, value)

  if you have two valid values for a given key, either do

   - last-writer wins, or
   - multivalue

-

counter CRDT

  lots of options, here's one:

  a set of counters
    one for each node

  value() = sum( set )

-

counter CRDT w/decrementing

  two counter CRDTs
    "inc" counter and "dec" counter

  value() = value( inc ) - value( dec )

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

example: delta-shipping a counter

  delta's only ship the node's own dimension in the vector

               a,b,c,d 
  full state: [5,6,5,2]
  delta:       b=6
  delta:       b=7
  delta:       b=8
  delta:       b=9
  full state: [5,9,5,2]

-

so that's state-based

what else is there?

-

operation-based CRDTS

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

example of exactly-once: append-only logs

-

an op-based counter

  every node emits "inc" and "dec"
  and receiving nodes just... do it
  
  because we have exactly-once delivery
  this is safe
  a inc or dec will never get double-counted

-

an op-based OR set

  rather than ship entire element & tombstone set
    we ship add(element, tag) and remove(tags)

  commutative:

    add( x )+add( y ) = add( y )+add( x )
    rem( x )+rem( y ) = rem( x )+rem( y )
    rem( x )+rem( x ) = rem( x )
    add( x )+rem( x ) = noop()    
    rem( x )+add( x ) = noop()    
    add( x )+add( x ) = --cant happen--

    (remember, x and y are actually globally-unique tags)

-

exactly once guarantees idempotence

but op-based requires "guaranteed causal delivery"


what's that about?

-

causal ordering

  guarantees:
    an operation always arrives
    after any operations it causally depends on

  eg:
    removes show up after adds

-

causal ordering

  is weaker than total ordering

  but achievable in an EC system

-

how is it done?

senders responsibility

  if the wire guarantees order
  just make sure you emit dependencies first

-

how is it done?

receivers responsibility

  "Tagged Reliable Causal Broadcast"

  each message has a unique tag
  each message lists its dependency's tags

  on receive, if dependencies are not met
    the message is buffered locally

-

now we can reduce our tombstone-set significantly

  add(tagA, 'a') // tagA added to elements
  remove(tagA)   // tagA removed from elements

  remove(tagB)   // tagA added to tombstones
  add(tagB, 'a') // tagA removed from tombstones

  add(tagC, 'a') // tagC added to elements
  remove(tagC)   // tagC removed from elements
  remove(tagC)   // tagC added to tombstones (edge-case accumulation)

-

great! getting pretty efficient

what if we want total order?

-

ok, so let's say we:

  keep doing ops-shipping
  keep doing causal ordering

  and create a totally-ordered ID-space which is infinitely divisible?

-

logoot: an ordered list

  uses totally-ordered positions
    in a continuous space

  meaning...
    
    for two positions, A and B,
      we can always find a C,
      which is between them 

      A < C < B

-

how?

  lists of integers

  if
    A = 0
    B = 1
  
  then we choose
    C = 0.5

-

and we just keep doing that

  between( 0.5, 1 ) = 0.5.5

  0.5 < 0.5.5 < 0.6
  0.6 < 0.6.5 < 0.7

  0       < 0.5
  0.5     < 0.5.5
  0.5.5   < 0.5.5.5
  0.5.5.5 < 0.6

-

there are infinite implicit zeroes

  0.5 == 0.5.0.0.0.0.0.0.0.0.0.....

-

so

  0.5 < 0.5.0.0.0.0.0.0.0.0.1

-

how to insert?

insertBetween( A, B, value ):
  1. generate a position between A and B
  2. append the node id to avoid conflicts
  3. write value to list at that generated position

-

now you have total order

-

and that's all for CRDTs

-

(for now)

-

questions?