export class RTClient {
  configure() { return Promise.resolve({}); }
  close() { return Promise.resolve(); }
  events() {
    return { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) };
  }
  sendAudio() { return Promise.resolve(); }
  sendItem() { return Promise.resolve(); }
  generateResponse() { return Promise.resolve(); }
  connectAvatar() { return Promise.resolve({}); }
}
