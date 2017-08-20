## notification preferences

The user notification preferences are stored as bitset value. Bitset are very effective and efficient for storing boolean values.

notification preferences are stored as 64 bit integer value, this means we can store upto a maximum of 64 boolean values.

For a user following are the notification preferences.

#### My Activities

8 rightmost bits are reserved for this category

- When a comment is posted (1<sup>st</sup> bit from right)
- When a picture is posted (2<sup>nd</sup> bit from right)
- When someone joins (3<sup>rd</sup> bit from right)


#### Friends & Followers

8 second rightmost (bit position 9 - 16 from right) bits are reserved for this category

- When someone follows me (9<sup>th</sup> bit from right)
- When a friends starts using let's (10<sup>th</sup> bit from right)


#### Offline Notifications

8 bits further from second category (bit position 17 - 24) is reserved for this category

- Send me invitations by email (17<sup>th</sup> bit from right)
- Send me invitations by sms (18<sup>th</sup> bit from right)



The following diagram demonstrates bit position for each of these settings


![notiifcation preferences bitset](https://gitlab.com/spanhawk/lets-aws-backend/raw/master/docs/notification-preferences.png)
