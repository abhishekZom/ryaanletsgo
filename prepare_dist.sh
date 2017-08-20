#!/bin/bash

# Unix Bash script to prepare the project for deployment.
# For deployment the common models directory will be copied over to workers as well as app folder.

echo 'Cleaning up old directories'
/bin/rm -rf ./app/models
/bin/rm -rf ./workers/models
/bin/rm -f ./app/constants.js
echo 'Creating new directories'
mkdir ./app/models
mkdir ./workers/models
echo 'Copying common files'
cp -r ./common/models/* ./app/models/
cp -r ./common/models/* ./workers/models/
cp ./common/constants.js ./app/
cp ./common/constants.js ./workers/

echo 'done'