// 解読ラボの総当たりを、画面を止めずに別スレッドで実行する
import { createSolver } from './columnar-solver.js';

self.onmessage = event => {
  const { cipher, options } = event.data;
  const solver = createSolver(cipher, options);
  while (!solver.finished()) {
    const task = solver.current();
    self.postMessage({ type: 'progress', n: task.n, done: solver.done, total: solver.total });
    solver.step();
  }
  self.postMessage({ type: 'done', results: solver.results(), tried: solver.tried });
};
