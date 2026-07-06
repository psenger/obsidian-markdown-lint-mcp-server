import { jest } from '@jest/globals';
import { EventEmitter } from 'node:events';
import { exitOnStdinClose } from '../../../src/lib/stdio-lifecycle.js';

describe('exitOnStdinClose', () => {
  it('does not exit until stdin signals disconnect', () => {
    const stdin = new EventEmitter();
    const exit = jest.fn();
    exitOnStdinClose(stdin, exit);
    expect(exit).not.toHaveBeenCalled();
  });

  it('exits with code 0 when stdin emits end', () => {
    const stdin = new EventEmitter();
    const exit = jest.fn();
    exitOnStdinClose(stdin, exit);
    stdin.emit('end');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits with code 0 when stdin emits close', () => {
    const stdin = new EventEmitter();
    const exit = jest.fn();
    exitOnStdinClose(stdin, exit);
    stdin.emit('close');
    expect(exit).toHaveBeenCalledWith(0);
  });

  it('exits only once when both end and close fire', () => {
    const stdin = new EventEmitter();
    const exit = jest.fn();
    exitOnStdinClose(stdin, exit);
    stdin.emit('end');
    stdin.emit('close');
    expect(exit).toHaveBeenCalledTimes(1);
  });
});
