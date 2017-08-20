## user

A user is the most abstract representation of a human interacting with the app. A user has various properties, some of these properties are defined by the human while others are defined by the app internally.

Below I am listing most common properties of a user

- id (internally defined) can uniquely identify a user in the system
- username
- email
- password
- profilePic
- phone numbers
- status (internally defined) use to determine current state of a user. A user can be active, blocked, email verified.


The status of a user is internally stored as a bitset value. Bitsets are very effective and efficient for storing this kind of data. `status` is stored as 32 bit integer, this means that upto 32 bits are available to store a status value. This means upto 2<sup>32</sup> possible statusses which is quite sufficient for this usecase.


Following diagram demonstrates user status value in detail.

![user status bitset](https://gitlab.com/spanhawk/lets-aws-backend/raw/master/docs/user.png)