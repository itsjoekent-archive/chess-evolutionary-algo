Pattern -> Move

- Evaluate list of pattern -> move tuples until one of the patterns is a match, and the given move is possible
  - If no patterns match, generate new pattern from the board
  - If a pattern matched but the move was not possible, copy the pattern and mutate the move
- On evolution, join 50% of both pattern lists
  - If pattern conflict, randomly pick winner 
- On mutation, randomly sort X% of patterns in the list

Patterns have certain conditions they can use,
- square position (A-H, 1-8)
- color (W/B)
- piece (P,K,B,R,Q,K)
- list of pieces [P,K,B,R,Q,K]

A pattern can have a list of absolute or relative matches. 
- An absolute match is a position and at least 1 other condition. eg:
  - Absolute square position (A-H, 1-8), color (W/B)
  - Absolute square position (A-H, 1-8), color (W/B), list of pieces [P,K,B,R,Q,K]
- A relative match can be one of the following
  - At least 1 non-position condition as the starting position, an adjacency rule, and at least 1 non-position condition for the adjacent.
  - The index of a prior condition, an adjacency rule, and at least 1 non-position condition for the adjacent.
  - An adjaceny rule is a direction relative to the board or the player (N/S/E/W/NE/NW/SE/SW), and how many squares to move (1-8,MIN,MAX).

The move associated with the pattern must be movivng from and to squares that are recognized as starting positions of matches in the pattern, and the moves must be a valid chess move. For example, if the Move involves a condition that matches on an array of pieces, the move must be valid for all of the pieces in the list.