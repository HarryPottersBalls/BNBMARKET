const { pool, serverInstance } = require('./server'); // Removed log_file import

module.exports = async () => {
  console.log('Global Teardown: Starting...');
  console.log('Global Teardown: pool defined?', !!pool);
  // console.log('Global Teardown: log_file defined?', !!log_file); // Removed
  console.log('Global Teardown: serverInstance defined?', !!serverInstance);

  if (pool) {
    try {
      await pool.end();
      console.log('Global Teardown: PostgreSQL pool closed.');
    } catch (error) {
      console.error('Global Teardown: Error closing PostgreSQL pool:', error.message);
    }
  }

  // Removed log_file handling
  // if (log_file) {
  //   try {
  //     log_file.end();
  //     console.log('Global Teardown: log_file closed.');
  //   } catch (error) {
  //     console.error('Global Teardown: Error closing log_file:', error.message);
  //   }
  // }

  if (serverInstance) {
    try {
      await new Promise((resolve, reject) => {
        serverInstance.close(err => {
          if (err) {
            console.error('Global Teardown: Error closing server:', err.message);
            reject(err);
          } else {
            console.log('Global Teardown: Server closed.');
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Global Teardown: Error closing server instance:', error.message);
    }
  }
  console.log('Global Teardown: Finished.');
};
