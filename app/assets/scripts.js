'use strict';

import { tools, stuff, alertStuff } from './dep.js';

function main() {
    tools();
    stuff();
    alertStuff();

    console.log('hi there from the main file');

    // fetch(document.getElementById('app').dataset.apiUrl + '/api')
    //     .then(result => {
    //         console.log(result);
    //         return result.json();
    //     })
    //     .then(result => {
    //         console.log(result);
    //     });
}
main();
