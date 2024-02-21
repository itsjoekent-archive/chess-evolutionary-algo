import { System } from '@chess-evolutionary-algo/pattern-engine';

const system = new System();
// system.subscribe('started_game', console.log);
// system.subscribe('tournament_started', console.log);
system.subscribe('game_ended', console.log);
system.subscribe('tournament_ended', console.log);
system.subscribe('instruction_match', console.log);

function test() {
  const result = system.startTournament();
  system.evolvePlayers(result);
  test();
}

system.setupTournament();
test();
