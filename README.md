# lets-aws-backend
---


This is the new migrated codebase from the existing repo. The existing codebase can be found [here](https://gitlab.com/lets-platform/aws-backend)

- This is a complete rewrite of the existing repo, keeping in mind scalability, ease of deployment and testing.
- The existing application is deployed on aws and uses lambda functions with dynamodb as datastore, amazon SNS as notification provider and amazon cognito as identity provider. Although this is sufficient for prototype application for production use cases this will not suffice. One major issue with this is testability. When there are so many independant moving parts in the system it is impossible to test them fully for all possible edge cases and race conditions. Also amazon SNS don't have any SLA guarantees.
- To make the system more robust, testable and scalable this is a complete reqrite of the existing app. This app moves away from aws based architecure to node.js based system. Below is a brief description about each technologies used.

  - express: Base api routing library.
  - RethinkDB: Realtime db.
  - ejabberd: Implementation of XMPP protocol with highly extensible api's. This is the main component of the system and is used to push updates to ios client in real time.
  - swagger: swagger is used for API definition.
  - RabbitMQ: RethinkDB will notify the listeners for any changes. RabbitMQ is a natural choice for distributing these changes to corresponding listeners. See [this](https://rethinkdb.com/docs/rabbitmq/javascript) integration guide.
  - Redis: Redis will be used for any caching.

### Local deployment

To deploy locally, you need to have following external dependencies.

- node.js: node.js latest LTS version should be installed. I suggest to use [nvm](https://github.com/creationix/nvm) to manage node versions locally.
- docker engine: If you are on a mac you install docker from [here](https://www.docker.com/docker-mac) this will auto install docker-compose utility. If you are on linux you have to install docker-compose separately. Install the latest stable version of both docker and docker-compose.

After above dependencies are installed, clone the repo and go to `<ROOT>/local` and start docker-compose services using `docker-compose up -d` the `-d` flag will run the services in daemon mode.

#### Install npm dependencies

After docker services are running, run `npm install` from root of project directory to install node dependencies for the project.

#### Configuration

By default the application will connect to `rethinkdb` and `rabbitmq` on `localhost` update this to the ip address of the docker container. If you are on mac than this default `localhost` will work.

#### Environment variables

Some of the sensitive configuration is exported as environment variables. Create a `.env` file in root of project and copy the content of secret environment variables into this file.

### Start server locally

To start the server from root of the project run `npm run start`.


### Production Deployment

The underlying cloud platform for the deployment of all these services will be aws ec2 instances.

For RethinkDB I recommend [compose](https://www.compose.com/pricing#rethinkdb-pricing).

For RabbitMQ I recommend [cloudamqp](https://www.cloudamqp.com/plans.html).

For redis I recommend aws [elasticache](https://aws.amazon.com/elasticache/).

To keep the datatransfer cost nil, all of these services will be deployed in same aws region.

ejabberd will be installed on a separate aws ec2 instance.