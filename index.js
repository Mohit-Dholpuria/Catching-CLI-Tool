// server.mjs
import { createServer } from 'node:http';
import { Command } from 'commander'; // Import commander
import  Redis  from 'ioredis';
import fetch from 'node-fetch';

const program = new Command(); // Create a new commander instance
const redis = new Redis();
redis.on('error', (err) => {
  console.error('Redis error:', err);
});

program
  .version('1.0.0')
  .description('A simple HTTP server')
  .option('-p, --port <number>', 'port to listen on', 3000) // Default port is 3000
  .option('-s, --server <url>', 'origin URL', 'http://localhost') // Default origin
  .option('-o, --origin <url>', 'actual server URL to forward requests to') // New option for actual server URL
  .option('--clear-cache', 'clear the Redis cache'); 
  program.parse(process.argv); // Parsing the command-line arguments

const options = program.opts();

if(options.clearCache){
  redis.flushall((err,result)=>{
    if(err){
      console.error('Error clearing cache:',err);
      process.exit(1);
    }
    console.log('cache cleared succesfully:',result);
    process.exit(0);
  })
}

const server = createServer(async (req, res) => {
  const cacheKey = req.url;

  try{
    const cachedResponse = await redis.get(cacheKey)
  
  if (cachedResponse) {
    console.log(cachedResponse)
    res.writeHead(200, { 'Content-Type': 'text/html','X-Cache': 'HIT'  });
    res.end(cachedResponse);
    return
  }
    const response = await fetch(`${options.origin}${req.url}`)

    const data = await response.text();

    if(response.ok){

      //cache the response in Redis with a TTL of 60 secs
      await redis.setex(cacheKey,60,data);
      res.writeHead(response.status, { 'Content-Type':  response.headers.get('content-type'),'X-Cache': 'MISS'  });
      res.end(data);
  
    }else{
      res.writeHead(response.status,{'Content-Type':'text/html'});
      res.end(`
         <html>
          <head>
            <title>Error</title>
          </head>
          <body>
            <h1>Error ${response.status}</h1>
            <p>There was an error fetching the requested resource.</p>
          </body>
        </html>
        `);
    }


  }
  catch(Error){
    console.log('error:',Error)
    res.writeHead(500,{'Content-Type':'text/plain'});
    res.end('Internal Server Error');
  }
});

// starts a simple http server locally on given  port
server.listen(options.port, () => {
  console.log(`Listening on port ${options.port}`);
  console.log(`Origin set to: ${options.origin}`);

});


