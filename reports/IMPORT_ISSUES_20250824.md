# NetSuite Import Exceptions
_Generated 2025-08-24 23:41:36 UTC_

## Summary
- Locked objects: **966**
- Disallowed path (/SuiteBundles etc.): **14**
- Permission violations: **16**
- Requires **Use as Field ID**: **5**
- Disabled feature referenced: **1**
- **Broken references** (dead fields in saved searches): **4**
- Inactive objects referenced: **0**
- **TOTAL exceptions:** 1006
- **ACTIONABLE (excludes locked + disallowed):** 26

## Actionable findings (tail of raw lines)
```
830:The following objects have not been imported:
886:    - crmcustomfield:custevent_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1108:    - customrecordtype:customrecord_cseg_dm_household failed: The Household feature is disabled. You can enable the Household feature by checking the Enable Household checkbox in the Household Preferences. To access the Household Preferences page, go to NFP CRM Center > Household Preferences > Household Preferences, and then click Edit next to the Household in the list..
1109:    - customrecordtype:customrecord_cseg_event failed: Permission Violation: You need a higher permission for value management of custom segment PS Event Year to access this page. Please contact your account administrator..
1110:    - customrecordtype:customrecord_cseg_project failed: Permission Violation: You need a higher permission for value management of custom segment Project (Custom Segment) to access this page. Please contact your account administrator..
1132:    - entitycustomfield:custentity_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1171:    - itemcustomfield:custitem_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1283:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1474:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1478:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1482:Details: There is no such custom FIELD object with specified key [CUSTENTITY_PANCAN_INTERNAL_ID] in the database.
1547:    - sublist:custsublist_15906_cus_eft_bd_logs failed: Permission Violation: You need  the 'Custom Sublist' permission to access this page. Please contact your account administrator..
1548:    - sublist:custsublist_15906_dd_bd_logs failed: Permission Violation: You need  the 'Custom Sublist' permission to access this page. Please contact your account administrator..
1549:    - sublist:custsublist_15906_eft_bd_logs failed: Permission Violation: You need  the 'Custom Sublist' permission to access this page. Please contact your account administrator..
1550:    - sublist:custsublist_243_5411584_sb1_226 failed: Permission Violation: You need  the 'Custom Sublist' permission to access this page. Please contact your account administrator..
1551:    - sublist:custsublist_dm_sc_soft_credits failed: Permission Violation: You need  the 'Custom Sublist' permission to access this page. Please contact your account administrator..
1552:    - subtab:custtab_10_4533432_230 failed: Permission Violation: You need  the 'Custom Subtabs' permission to access this page. Please contact your account administrator..
1553:    - subtab:custtab_11_4533432_230 failed: Permission Violation: You need  the 'Custom Subtabs' permission to access this page. Please contact your account administrator..
1554:    - subtab:custtab_12_4533432_230 failed: Permission Violation: You need  the 'Custom Subtabs' permission to access this page. Please contact your account administrator..
1555:    - subtab:custtab_31_5435884_159 failed: Permission Violation: You need  the 'Custom Subtabs' permission to access this page. Please contact your account administrator..
1556:    - subtab:custtab_9_4533432_230 failed: Permission Violation: You need  the 'Custom Subtabs' permission to access this page. Please contact your account administrator..
1557:    - subtab:custtab_adjustments_subtab_transaction failed: Permission Violation: You need  the 'Custom Subtabs' permission to access this page. Please contact your account administrator..
1558:    - subtab:custtab_dm_soft_credit failed: Permission Violation: You need  the 'Custom Subtabs' permission to access this page. Please contact your account administrator..
1701:    - transactionbodycustomfield:custbody_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1749:    - transactioncolumncustomfield:custcol_cseg1 failed: Enable the "Use as Field ID" option on the custom segment.  This option lets you download the custom segment XML or deploy it to your account.
1829:    - workflow:customworkflow_2663_update_batch failed: Permission Violation: You need a higher level of the 'Workflow' permission to access this page. Please contact your account administrator..
1830:    - workflow:customworkflow_8299_lock_cat_record failed: Permission Violation: You need a higher level of the 'Workflow' permission to access this page. Please contact your account administrator..
```
