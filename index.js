"use strict";
const   config = require('./config'),
        CoinbaseClient = require('coinbase').Client,
        Transaction = require('coinbase').Transaction
;


const client = new CoinbaseClient({'apiKey': config.api_key, 'apiSecret': config.api_secret});



// Helper function to display error message and then quit the program.
const processError = function(scope, err) {
    if (err != null) {
        console.log(scope + ': ' + err);
        process.exit(1);
    }
}


// Find if received a transaction in 24 hours. 
// If yes, half of the amount should be sent to my friend.
const processTransactions = function(txnList) {
    if (txnList.length != 0) {
        if ( !(txnList instanceof Array) && !(txnList[0] instanceof Transaction) ) {
            throw "An array of type 'Transaction' is expected.";
        }

        var applicableAmountList = [];
        const currentDate = new Date();
        txnList.forEach(function(txn, index) {
            const updatedDate = new Date(txn.updated_at);
            const diffHours = (currentDate - updatedDate) / (1000 * 60 * 60);

            if (diffHours < 24 && txn.status === 'completed' && txn.type === 'send') {
                applicableAmountList.push(txn.amount);
                // console.log(txn);
            }
        });

        if (applicableAmountList.length == 0) {
            console.log('No applicable transactions in the wallet. Program exits...');
            return -1;
        } else {
            var totalAmount = 0;
            applicableAmountList.forEach(function(amountObj, index) {
                totalAmount += parseFloat(amountObj.amount);
            });
            return totalAmount / 2.0;
        }


    } else {
        console.log('No transactions in the wallet. Program exits...');
        return -1;
    }
}


client.getCurrentUser(function(err, user) {
    processError('Get Current User', err);

    console.log('Logged in as ' + user.name);
    console.log('================================================');

    // Get all transactions under a specific address.
    client.getAccount(config.account_id, function(err, account) {
        processError('Get Account', err);

        // Loop through all addresses returned by Coinbase API to find the address ID (UUID)
        // which is used to look up transactions sent to that address.
        account.getAddresses(null, function(err, addr) {
            processError('Get All Addresses', err);
            console.log("All addresses for account " + account.name + ": " + addr);

            var ethermine_addr_id = '';
            addr.forEach(function(val, index) {
                if (ethermine_addr_id == '' && val.address === config.ethermine_addr) {
                    ethermine_addr_id = val.id;
                }
            })
            if (ethermine_addr_id == '') {
                processError('The given ETH address is not found in Coinbase. ');
            }

            account.getAddress(ethermine_addr_id, function(err, addr) {
                processError('Get Address', err);
                
                addr.getTransactions(null, function(err, txnList) {
                    processError('Get Transactions', err);
                    var amount = processTransactions(txnList);

                    if (amount > 0) {
                        const opts = {
                            'to': config.to_address,
                            'amount': amount.toFixed(8), // Coinbase only accept 8 decimal places amount
                            'currency': 'ETH'
                        };
                        console.log('Sending to ' + opts.to + ' with ' + opts.currency + ' ' + opts.amount + ' ...');
                        account.sendMoney(opts, function(err, txn) {
                            processError('Create Send Money Transaction', err);
                            console.log('\n\nTransaction created: \n' + txn);
                        });
                    }
                });
            });

        });

    });
});