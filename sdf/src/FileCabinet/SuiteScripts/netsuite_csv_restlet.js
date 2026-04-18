/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

define(['N/search'], function(search) {
    
    function calculateFiscalYearDates(asOfDateStr) {
        var asOf = new Date(asOfDateStr);
        var asOfYear = asOf.getFullYear();
        var asOfMonth = asOf.getMonth();
        
        var fyStartYear, fyEndYear;
        
        if (asOfMonth >= 6) {
            fyStartYear = asOfYear;
            fyEndYear = asOfYear + 1;
        } else {
            fyStartYear = asOfYear - 1;
            fyEndYear = asOfYear;
        }
        
        var fyStart = '07/01/' + fyStartYear;
        var fyEnd = '06/30/' + fyEndYear;
        var priorFyEnd = '06/30/' + fyStartYear;
        var asOfFormatted = formatDateForFormula(asOf);
        
        return {
            fyStart: fyStart,
            fyEnd: fyEnd,
            priorFyEnd: priorFyEnd,
            asOfDate: asOfFormatted
        };
    }
    
    function formatDateForFormula(date) {
        var month = (date.getMonth() + 1).toString();
        var day = date.getDate().toString();
        var year = date.getFullYear();
        
        if (month.length === 1) month = '0' + month;
        if (day.length === 1) day = '0' + day;
        
        return month + '/' + day + '/' + year;
    }
    
    function createDynamicSearch(dates) {
        var filters = [
            ['accounttype', 'anyof', 'Equity', 'Income', 'COGS', 'Expense', 'OthIncome', 'OthExpense', '@NONE@'],
            'AND',
            ['type', 'noneof', 'ItemShip'],
            'AND',
            ['class', 'noneof', '@NONE@', '3', '5', '19', '20', '21', '17'],
            'AND',
            ['trandate', 'onorbefore', dates.asOfDate]
        ];
        
        var columns = [
            search.createColumn({ 
                name: 'class', 
                summary: search.Summary.GROUP 
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {posting} = 'T' AND {trandate} <= TO_DATE('" + dates.priorFyEnd + "', 'MM/DD/YYYY') AND {account.externalid} = '3080' THEN {amount} ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {accounttype} IN ('Revenue', 'Other Revenue') AND {line.cseg_npo_restrictn} = 'With Donor Restrictions' THEN {amount} ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {type} = 'Release from Restriction' THEN -{debitamount} ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {posting} = 'T' AND {trandate} <= TO_DATE('" + dates.priorFyEnd + "', 'MM/DD/YYYY') AND {account.externalid} = '3080' THEN {amount} ELSE 0 END, 0) + NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {accounttype} IN ('Revenue', 'Other Revenue') AND {line.cseg_npo_restrictn} = 'With Donor Restrictions' THEN {amount} ELSE 0 END, 0) - NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {type} = 'Release from Restriction' THEN {debitamount} ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN ({custrecord_linked_pledge_order.custrecord_ps_installment_date} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') OR {custrecord_linked_pledge_order.custrecord_ps_time_restriction} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY')) AND {custrecord_linked_pledge_order.isinactive} = 'F' AND {custrecord_linked_pledge_order.custrecord_linked_pledge_date} <= TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') THEN -CASE WHEN {custrecord_linked_pledge_order.custrecord_ps_time_restriction} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') AND ({custrecord_linked_pledge_order.custrecord_ps_time_restriction} > {custrecord_linked_pledge_order.custrecord_ps_installment_date} OR {custrecord_linked_pledge_order.custrecord_ps_installment_date} IS NULL) THEN {custrecord_linked_pledge_order.custrecord_ps_installment_amt} ELSE {custrecord_linked_pledge_order.custrecord_installment_amt_remaining} END ELSE 0 END, 0)"
            }),
            search.createColumn({ 
                name: 'formulacurrency', 
                summary: search.Summary.SUM, 
                formula: "NVL(CASE WHEN {posting} = 'T' AND {trandate} <= TO_DATE('" + dates.priorFyEnd + "', 'MM/DD/YYYY') AND {account.externalid} = '3080' THEN {amount} ELSE 0 END, 0) + NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {accounttype} IN ('Revenue', 'Other Revenue') AND {line.cseg_npo_restrictn} = 'With Donor Restrictions' THEN {amount} ELSE 0 END, 0) - NVL(CASE WHEN {posting} = 'T' AND {trandate} >= TO_DATE('" + dates.fyStart + "', 'MM/DD/YYYY') AND {trandate} <= TO_DATE('" + dates.asOfDate + "', 'MM/DD/YYYY') AND {type} = 'Release from Restriction' THEN {debitamount} ELSE 0 END, 0) - NVL(CASE WHEN ({custrecord_linked_pledge_order.custrecord_ps_installment_date} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') OR {custrecord_linked_pledge_order.custrecord_ps_time_restriction} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY')) AND {custrecord_linked_pledge_order.isinactive} = 'F' AND {custrecord_linked_pledge_order.custrecord_linked_pledge_date} <= TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') THEN CASE WHEN {custrecord_linked_pledge_order.custrecord_ps_time_restriction} > TO_DATE('" + dates.fyEnd + "', 'MM/DD/YYYY') AND ({custrecord_linked_pledge_order.custrecord_ps_time_restriction} > {custrecord_linked_pledge_order.custrecord_ps_installment_date} OR {custrecord_linked_pledge_order.custrecord_ps_installment_date} IS NULL) THEN {custrecord_linked_pledge_order.custrecord_ps_installment_amt} ELSE {custrecord_linked_pledge_order.custrecord_installment_amt_remaining} END ELSE 0 END, 0)"
            })
        ];
        
        return search.create({
            type: 'transaction',
            filters: filters,
            columns: columns
        });
    }
    
    function get(context) {
        try {
            var asOfDate = context.asOfDate;
            if (!asOfDate) {
                throw new Error('As-of date is required');
            }
            
            var dates = calculateFiscalYearDates(asOfDate);
            var dynamicSearch = createDynamicSearch(dates);
            var searchResults = [];
            
            var pagedData = dynamicSearch.runPaged({ pageSize: 1000 });
            
            for (var i = 0; i < pagedData.pageRanges.length; i++) {
                var page = pagedData.fetch({ index: i });
                page.data.forEach(function(result) {
                    var columns = dynamicSearch.columns;
                    searchResults.push({
                        program: result.getText(columns[0]) || 'Unclassified',
                        openingBalance: result.getValue(columns[1]) || 0,
                        fyRestrictedRevenue: result.getValue(columns[2]) || 0,
                        restrictedNAReleased: result.getValue(columns[3]) || 0,
                        endingBalance: result.getValue(columns[4]) || 0,
                        lessTimeRestricted: result.getValue(columns[5]) || 0,
                        endingBalanceEligible: result.getValue(columns[6]) || 0
                    });
                });
            }
            
            // Generate CSV content
            var fyLabel = 'FY' + dates.fyEnd.substring(8, 10);
            var csvContent = 'PROGRAM,OPENING BAL. RESTRICTED NA AS OF ' + dates.priorFyEnd + ',' + fyLabel + ' RESTRICTED REVENUE,RESTRICTED NA RELEASED IN ' + fyLabel + ',' + fyLabel + ' ENDING RESTRICTED NA BAL.,LESS TIME RESTRICTED,' + fyLabel + ' ENDING RESTRICTED NA BAL. ELIGIBLE FOR RELEASE\n';
            
            var totals = {
                openingBalance: 0,
                fyRestrictedRevenue: 0,
                restrictedNAReleased: 0,
                endingBalance: 0,
                lessTimeRestricted: 0,
                endingBalanceEligible: 0
            };
            
            for (var j = 0; j < searchResults.length; j++) {
                var result = searchResults[j];
                
                totals.openingBalance += parseFloat(result.openingBalance) || 0;
                totals.fyRestrictedRevenue += parseFloat(result.fyRestrictedRevenue) || 0;
                totals.restrictedNAReleased += parseFloat(result.restrictedNAReleased) || 0;
                totals.endingBalance += parseFloat(result.endingBalance) || 0;
                totals.lessTimeRestricted += parseFloat(result.lessTimeRestricted) || 0;
                totals.endingBalanceEligible += parseFloat(result.endingBalanceEligible) || 0;
                
                csvContent += '"' + result.program + '",' + result.openingBalance + ',' + result.fyRestrictedRevenue + ',' + result.restrictedNAReleased + ',' + result.endingBalance + ',' + result.lessTimeRestricted + ',' + result.endingBalanceEligible + '\n';
            }
            
            csvContent += '"Total",' + totals.openingBalance + ',' + totals.fyRestrictedRevenue + ',' + totals.restrictedNAReleased + ',' + totals.endingBalance + ',' + totals.lessTimeRestricted + ',' + totals.endingBalanceEligible + '\n';
            
            return csvContent;
            
        } catch (error) {
            return 'Error: ' + error.toString();
        }
    }
    
    return {
        get: get
    };
});