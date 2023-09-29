#export NODE_ENV=development
export NODE_ENV=production

#DEBUG=* rimraf ./build && tsc && node build/app.js
# rimraf ./build && tsc && node build/app.js
node build/app.js

