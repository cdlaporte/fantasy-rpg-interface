// The teacher's question provider goes here. See docs/QUESTIONS.md for a complete, commented example
// (a question bank in JSON plus a provider that shows it in the game's question window).
//
// While this file exports null, the game uses the placeholder card from stubProvider.js.
//
// A provider is an object with an id and an ask() function:
//
//   export default {
//     id: 'my-bank',
//     // req = { context: 'gate', difficulty: 2, tags: ['geometry'], optional: false, attempt: 1 }
//     // el  = an empty <div> inside the game's question window: put your question in it.
//     ask(req, el) {
//       return new Promise((resolve) => {
//         const p = document.createElement('p');
//         p.textContent = 'What is 7 x 8?';
//         const input = document.createElement('input');
//         const btn = document.createElement('button');
//         btn.textContent = 'Check';
//         btn.onclick = () => resolve({ correct: input.value.trim() === '56', skipped: false });
//         el.append(p, input, btn);
//       });
//     },
//   };

export default null;
