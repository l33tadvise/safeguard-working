# NetSuite Import Exceptions
_Generated 2025-08-25 15:21:32 UTC_

## Summary
- Locked objects: **966**
- Disallowed path (/SuiteBundles etc.): **14**
- Permission violations: **4**
- Requires **Use as Field ID**: **5**
- Disabled feature referenced: **1**
- **Broken references** (dead fields in saved searches): **4**
- Inactive objects referenced: **0**
- **TOTAL exceptions:** 994
- **ACTIONABLE (excludes locked + disallowed):** 14

## Actionable findings (tail of raw lines)
```
843:The following objects have not been imported:
899:    - crmcustomfield:custevent_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1121:    - customrecordtype:customrecord_cseg_dm_household failed: The Household feature is disabled. You can enable the Household feature by checking the Enable Household checkbox in the Household Preferences. To access the Household Preferences page, go to NFP CRM Center > Household Preferences > Household Preferences, and then click Edit next to the Household in the list..
1122:    - customrecordtype:customrecord_cseg_event failed: Permission Violation: You need a higher permission for value management of custom segment PS Event Year to access this page. Please contact your account administrator..
1123:    - customrecordtype:customrecord_cseg_project failed: Permission Violation: You need a higher permission for value management of custom segment Project (Custom Segment) to access this page. Please contact your account administrator..
1145:    - entitycustomfield:custentity_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1184:    - itemcustomfield:custitem_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1296:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1487:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1491:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1495:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1702:    - transactionbodycustomfield:custbody_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1750:    - transactioncolumncustomfield:custcol_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1830:    - workflow:customworkflow_2663_update_batch failed: Permission Violation: You need a higher level of the 'Workflow' permission to access this page. Please contact your account administrator..
1831:    - workflow:customworkflow_8299_lock_cat_record failed: Permission Violation: You need a higher level of the 'Workflow' permission to access this page. Please contact your account administrator..
```
