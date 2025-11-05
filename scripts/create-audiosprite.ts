import { exec } from 'child_process';

const command = `
npx audiosprite \
  --output "src/__tests__/sounds/mygameaudio" \
  --format "howler" \
  --loop "bg_loop" \
  src/__tests__/sounds/bg_loop.wav \
  src/__tests__/sounds/Sound_1.m4a \
  src/__tests__/sounds/Sound_2.m4a \
  src/__tests__/sounds/Sound_3.m4a \
  src/__tests__/sounds/Sound_4.m4a
`;

exec(command, (err, stdout, stderr) => {
  if (err) {
    console.error(err);
    return;
  }
  console.log(stdout);
  console.error(stderr);
});
