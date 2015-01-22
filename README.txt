CRDTs 2 part 2

-

(of n)

-

you're building a dist sys
either because of scale or arch...
nodes are not able to sync in real time

-

nodes act on their own
then reconcile state afterwards

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

so

  two nodes make concurrent changes
  how do we reconcile them?

-

what if...

  we made data structures
  that could NEVER CONFLICT

-

like idempotence

  idemptotent values cant have conflicting changes
  because you can only change them once
  and, if it's already changed, it stays changed

  that's why we like them

-

so can we get more stuff like idempotence?

-

yep: CRDTs

-

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
  all of the type's methods are monotonic

  - an int where `++` is the only op
  - an idempotent value (aka a bool where `set(true)` is the only op)  
  - the levels in super mario

-

join-semilattice
  a partially ordered set
  has a join operation called LUB

  "least upper bound"
  
  join( x, y ) =
  - the least element of the semilattice
  - which is >= both x and y

-

example
given A,B,C,D, where:

  A < B 
  A < C
  B < D
  C < D

  (use whiteboard)

  join( A, B ) = B
  join( A, C ) = C
  join( B, C ) = D

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

the growset CRDT

  a set where state only grows

  join( S1, S2 )       = union( S1, S2 )
  join( [a,b], [c] )   = [a,b,c]
  join( [a,b,c], [c] ) = [a,b,c]

  one op: add
  add( [a,b], c ) = [a,b,c]
  add( [a,b,c], c ) = [a,b,c]

-

the 2P-set CRDT
  a set where elements can be removed...
  ...but never re-added
  uses two growsets: elements and tombstones

  join( S1, S2 ) = [
    join( S1.elements,   S2.elements ),
    join( S1.tombstones, S2.tombstones )
  ]

  two ops: add, remove
     add( S, x ) = add( S.elements,   x )
  remove( S, x ) = add( S.tombstones, x )

  value = S.elements - S.tombstones

-

the observed-remove set CRDT
  a set where elements can freely add and remove
  each element is tagged with a unique id

  join(S1, S2) = [
    join( S1.element-tags,   S2.element-tags ),
    join( S1.tombstone-tags, S2.tombstone-tags )
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
  requirement: 
   - exactly-once deliver
   - guaranteed causal delivery

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

but op-based also requires "guaranteed causal delivery"


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