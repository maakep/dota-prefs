import express from 'express';

const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Server is up');
});

app.listen(PORT, () => {
  console.log(`Server is running at ${PORT}`);
});