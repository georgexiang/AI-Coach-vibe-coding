export class RTClient {
  configure() { return Promise.resolve({}); }
  close() { return Promise.resolve(); }
  responses() {
    return { [Symbol.asyncIterator]: () => ({ next: () => new Promise(() => {}) }) };
  }
  sendItem() {}
  generateResponse() {}
}
