import { Client } from 'pg';
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query(`UPDATE users SET date_of_birth = '2000-01-01' WHERE date_of_birth IS NULL`))
  .then(() => { console.log('done'); client.end(); })
  .catch(console.error);
