export default defineContentScript({
  matches: ['*://localhost/*', '*://127.0.0.1/*'],
  main() {
    console.log('Extension Manager: Active on localhost');
  },
});
