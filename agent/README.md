# Agent

This folder contains agent-related files and configuration for developer tooling and automation.

* Purpose: store agent scripts, instructions, and metadata used by developer agents.
* Location: project-root/agent

If you want specific agent docs or templates added here, tell me what to include.

#sample event payloads

***Normal event*** 

{

&nbsp; "event\_id": "evt\_001",

&nbsp; "patient\_id": "patient\_001",

&nbsp; "lat": 6.9271,

&nbsp; "lng": 79.8612,

&nbsp; "medicine\_taken": true,

&nbsp; "movement": true,

&nbsp; "last\_sos\_triggered\_time": "2026-03-08T18:10:00Z"

}



***SOS EVENT***

{

&nbsp; "event\_id": "evt\_002",

&nbsp; "patient\_id": "patient\_001",

&nbsp; "sos\_triggered": true,

&nbsp; "sos\_triggered\_time": "2026-03-09T14:32:00Z",

&nbsp; "last\_sos\_triggered\_time": "2026-03-08T18:10:00Z"

}





\#output sample 



{

&nbsp;   "event\_id": "evt\_001",

&nbsp;   "patient\_id": "patient\_001",

&nbsp;   "result": {

&nbsp;       "triggered": true,

&nbsp;       "rules\_triggered": \[

&nbsp;           {

&nbsp;               "triggered": true,

&nbsp;               "case": "GEOFENCE\_BREACH",

&nbsp;               "action": "SEND\_GEOFENCE\_ALERT",

&nbsp;               "reason": "Patient outside home boundary",

&nbsp;               "context": {

&nbsp;                   "stay\_home": false,

&nbsp;                   "distance\_meters": 110383.23

&nbsp;               }

&nbsp;           },

&nbsp;           {

&nbsp;               "triggered": true,

&nbsp;               "case": "NO\_MOVEMENT",

&nbsp;               "action": "SEND\_UNUSUAL\_ACTIVITY\_ALERT",

&nbsp;               "reason": "No movement detected during active time"

&nbsp;           },

&nbsp;           {

&nbsp;               "triggered": true,

&nbsp;               "case": "MISSED\_MEDICATION",

&nbsp;               "action": "SEND\_REMINDER",

&nbsp;               "reason": "Medication not taken"

&nbsp;           }

&nbsp;       ]

&nbsp;   },

&nbsp;   "actions": \[

&nbsp;       {

&nbsp;           "case": "GEOFENCE\_BREACH",

&nbsp;           "action": "SEND\_GEOFENCE\_ALERT",

&nbsp;           "reason": "Patient outside home boundary"

&nbsp;       },

&nbsp;       {

&nbsp;           "case": "NO\_MOVEMENT",

&nbsp;           "action": "SEND\_UNUSUAL\_ACTIVITY\_ALERT",

&nbsp;           "reason": "No movement detected during active time"

&nbsp;       },

&nbsp;       {

&nbsp;           "case": "MISSED\_MEDICATION",

&nbsp;           "action": "SEND\_REMINDER",

&nbsp;           "reason": "Medication not taken"

&nbsp;       }

&nbsp;   ]

}





