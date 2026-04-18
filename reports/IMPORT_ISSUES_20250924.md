# NetSuite Import Exceptions
_Generated 2025-09-24 06:09:34 UTC_

## Summary
- Locked objects: **975**
- Disallowed path (/SuiteBundles etc.): **15**
- Permission violations: **2**
- Requires **Use as Field ID**: **5**
- Disabled feature referenced: **1**
- **Broken references** (dead fields in saved searches): **4**
- Inactive objects referenced: **0**
- **TOTAL exceptions:** 1002
- **ACTIONABLE (excludes locked + disallowed):** 12

## Actionable findings (tail of raw lines)
```
855:The following objects have not been imported:
912:    - crmcustomfield:custevent_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1134:    - customrecordtype:customrecord_cseg_dm_household failed: The Household feature is disabled. You can enable the Household feature by checking the Enable Household checkbox in the Household Preferences. To access the Household Preferences page, go to NFP CRM Center > Household Preferences > Household Preferences, and then click Edit next to the Household in the list..
1156:    - entitycustomfield:custentity_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1195:    - itemcustomfield:custitem_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1311:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1502:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1506:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1510:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1718:    - transactionbodycustomfield:custbody_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1766:    - transactioncolumncustomfield:custcol_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1849:    - workflow:customworkflow_2663_update_batch failed: Permission Violation: You need a higher level of the 'Workflow' permission to access this page. Please contact your account administrator..
1850:    - workflow:customworkflow_8299_lock_cat_record failed: Permission Violation: You need a higher level of the 'Workflow' permission to access this page. Please contact your account administrator..
```
