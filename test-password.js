const bcrypt = require('bcrypt');

const password = 'TestPassword123\!';
const hash = '$2b$10$U4Rqew3NwgJEd.DoT4Kbu..az5oFODhOtr2fd1HJD5l9ROLQLo02G';

console.log('Testing password:', password);
console.log('Against hash:', hash);

bcrypt.compare(password, hash, (err, result) => {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log('Password matches:', result);
  }
});
