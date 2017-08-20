#!/bin/bash

# Unix Bash script to cleanup the deployment.
# For deployment the common models directory will be copied over to workers as well as app folder.
# For cleanup both app/models and workers/models directory will be cleaned up

echo 'Cleaning up old directories'
/bin/rm -rf ./app/models
/bin/rm -rf ./workers/models
/bin/rm -f ./app/constants.js
/bin/rm -f ./workers/constants.js

echo 'done'