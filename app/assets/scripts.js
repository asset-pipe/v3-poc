'use strict';

import lodash from 'lodash';
import get from 'lodash.get';
import { tools, stuff, alertStuff } from './dep.js';

function main() {
    tools();
    stuff();
    alertStuff();

    console.log('hi there from the main file');
    console.log('lodash.get', lodash.get);
    console.log('get', get);
}
main();
