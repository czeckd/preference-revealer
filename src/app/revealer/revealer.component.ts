import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { Base64 } from 'js-base64';

import { environment } from '../../environments/environment';

declare var lzwCompress:any;


//  see Knuth vol.3 SORTING AND SEARCHING for description of Ford-Johnson algorithm (AKA merge insertion)
//  negatives for distinguishing from item indices
//  first step is PairSORT, which invokes KEYALIGN, which invokes MERGE
enum Sort { PSORT = -1, KEYSORTODD = -2, KEYSORTEVEN = -3, KEYALIGN = -4, MERGE = -5, BINSERT = -6 }

@Component({
	selector: 'app-revealer',
	templateUrl: './revealer.component.html',
	styleUrls: ['./revealer.component.css']
})
export class RevealerComponent implements OnInit {

	collapse = true;
	showAbout = false;
	baseUrl:string;
	list = '';

	stack:Array<Sort>;

	action:Sort;
	aux;

	items = [];
	itemsLen:number = -1;
	results = [];
	comps = 0;
	worst:number;

	btnOne:string;
	btnTwo:string;
	btnOneFunc;
	btnTwoFunc;
	name = '';
	encoded:string;
	done = false;

	constructor(vcr:ViewContainerRef, private location:Location, private route:ActivatedRoute, private router:Router) {
	}

	ngOnInit() {
		this.stack = [ Sort.PSORT ];
		this.done = false;

		this.baseUrl = location.origin;

		this.route.queryParams.subscribe( params => {

			const list = params['data'];
			if (list) {
				let data = lzwCompress.unpack(Base64.decode(list).split(','));
				if (data.items) {
					this.items = data.items;
					this.list = data.items.join('\n');
				}

				this.name = data.name;
				this.itemsLen = (data.results ? data.results.length : -1);
				if (this.itemsLen !== -1) {
					this.showResults(data.results, true);
				}
			}
		});

	}

	private log2(x:number) : number {
		return Math.log(x) / Math.LN2;
	}

	submitList() {
		this.stack = [ Sort.PSORT ];
		this.done = false;

		this.items = this.list.split('\n');
		this.itemsLen = this.items.length;

		for (let a = 0; a < this.itemsLen; a += 1) {
			// Remove whitespace-only lines.
			while (!(/\S/.test(this.items[a]))) {
				this.items.splice(a, 1);
				this.itemsLen -= 1;
			}
		}

		if (this.itemsLen > 1) {
			this.worst = this.itemsLen * Math.ceil(this.log2(this.itemsLen * 3 / 4)) - Math.floor((1 << Math.floor(this.log2(this.itemsLen * 6))) / 3) + Math.floor(this.log2(this.itemsLen * 6) / 2);

			// TODO: Use lodash shuffle

			// array-shuffling one-liner by Jonas Raoni Soares Silva:  http://jsfromhell.com/array/shuffle
			for (let j, x, i = this.itemsLen; i; j = Math.floor(Math.random() * i), x = this.items[--i], this.items[i] = this.items[j], this.items[j] = x);

			this.aux = new Array(this.itemsLen);
			for (let k = 0; k < this.itemsLen; k += 1) {
				this.aux[k] = k;
			}
			this.beginStep();
		}
	}

	beginStep() {
		this.action = this.stack.pop();

		switch (this.action) {
		case Sort.PSORT:
			//  expect this.aux to be array of indices of this.items to sort
			//  outer layer still references this.aux, so don't destroy
			if (this.aux.length > 1) {
				if (this.aux.length % 2 == 1) {
					this.stack.push(this.aux[0]);
					this.stack.push(Sort.KEYSORTODD);
					this.stack = this.stack.concat(this.aux.slice(1));
				} else {
					this.stack.push(Sort.KEYSORTEVEN);
					this.stack = this.stack.concat(this.aux);
				}
				this.aux = [[],[]];
				this.showChoices(this.stack.pop(), this.stack.pop());
			} else {
				this.beginStep();
			}
			break;
		case Sort.KEYALIGN:  //  reorder losers to match sorted winners
			//  expect this.stack[-1][0] to be array of winners of pairwise comparisons
			//  expect this.stack[-1][1] to be array of losers of pairwise comparisons, plus odd element if exists
			//  expect aux to be sorted array of winners
			let w = this.aux.length;
			this.aux = [this.aux, new Array(w), new Array(w), [0, 1, 0, 0]];  //  first insertion
			//  this.aux[0] is now the main chain
			let oldaux = this.stack.pop();
			let keydict = new Array(this.itemsLen);

			for (let i = 0; i < w; i += 1) {
				keydict[oldaux[0][i]] = oldaux[1][i];
			}

			for (let j = 0; j < w; j+= 1) {
				this.aux[1][j] = keydict[this.aux[0][j]];
				this.aux[2][j] = 0;
			}
			if (w < oldaux[1].length)   //  check for odd element
			{
				this.aux[1][w] = oldaux[1][w];
			}
			//  fall through
		case Sort.MERGE:
			//  expect this.aux[0] to be the main chain
			//  expect this.aux[1] to be post-KEYALIGN array of losers, plus odd element if exists
			//  expect this.aux[2] to be array of offsets from old indices to projected indices as main chain grows
			//  expect this.aux[3][0] to be k
			//  expect this.aux[3][1] to be t_k
			//  expect this.aux[3][2] to be loser index of loser to insert
			//  expect this.aux[3][3] to be insertion position in main chain
			this.aux[0].splice(this.aux[3][3], 0, this.aux[1][this.aux[3][2]]);
			if ((this.aux[3][2] == 0) || (this.aux[3][2] == this.aux[3][1])) {
				this.aux[3][0] += 1;
				this.aux[3][1] = (1 << this.aux[3][0]) - this.aux[3][1];
				let l = this.aux[1].length;
				if (this.aux[3][1] < l)	 {
					this.aux[3][2] = Math.min(l - 1, (2 << this.aux[3][0]) - this.aux[3][1] - 1);
					this.aux[3][3] = 0;
					this.aux[3][4] = this.aux[3][1] + this.aux[3][2];
					this.stack.push(Sort.BINSERT);
				} else {
					this.stack.push(this.aux[0]);
				}
			} else {
				this.aux[3][2] -= 1;
				let k = this.aux[3][2];
				while (this.aux[3][1] + k + this.aux[2][k] >= this.aux[3][3])  //  while previous insertion affects max position
				{
					this.aux[2][k] += 1;
					k--;	//  test conveniently fails when we reach old this.items we don't care about
				}
				this.aux[3][3] = 0;
				this.aux[3][4] = this.aux[3][1] + this.aux[3][2] + this.aux[2][this.aux[3][2]];
				this.stack.push(Sort.BINSERT);
			}

			this.beginStep();
			break;

		case Sort.BINSERT:
			//  expect this.aux[3][0] to be k
			//  expect this.aux[3][1] to be t_k
			//  expect this.aux[3][2] to be loser index of loser to insert
			//  expect this.aux[3][3] to be min position in main chain
			//  expect this.aux[3][4] to be max position in main chain
			this.aux[3][5] = Math.ceil((this.aux[3][3] + this.aux[3][4]) / 2) - 1;
			this.showChoices(this.aux[1][this.aux[3][2]], this.aux[0][this.aux[3][5]]);
			break;

		default:
			//  expect to have encountered sorted array
			if (this.stack.length > 0) {
				this.aux = this.action;
				this.beginStep();
			} else {
				this.showResults(this.action, true);
			}
			break;
		}
	}


	endStep(x:Sort, y:Sort) {
		this.comps++;

		switch (this.action) {
		case Sort.PSORT:
			//  expect this.aux[0] to be array of winners of pairwise comparisons
			//  expect this.aux[1] to be array of losers of pairwise comparisons
			this.aux[0].push(x);
			this.aux[1].push(y);
			let popped = this.stack.pop();
			if (popped < 0) {
				if (popped == Sort.KEYSORTODD)   //  other possible value is KEYSORTEVEN
				{
					this.aux[1].push(this.stack.pop());
				}
				this.stack.push(this.aux);
				this.stack.push(Sort.KEYALIGN);
				this.stack.push(Sort.PSORT);  //  recur to sort winners
				this.aux = this.aux[0];
				this.beginStep();
			} else {
				this.showChoices(popped, this.stack.pop());
			}
			break;
		case Sort.BINSERT:
			//  expect this.aux[3][0] to be k
			//  expect this.aux[3][1] to be t_k
			//  expect this.aux[3][2] to be loser index of loser to insert
			//  expect this.aux[3][3] to be min position in main chain
			//  expect this.aux[3][4] to be max position in main chain
			//  expect this.aux[3][5] to be main chain index of comparand
			if (x == this.aux[1][this.aux[3][2]]) {
				this.aux[3][3] = this.aux[3][5] + 1;
			} else {
				this.aux[3][4] = this.aux[3][5];
			}
			if (this.aux[3][3] == this.aux[3][4]) {
				this.stack.push(Sort.MERGE);
			} else {
				this.stack.push(Sort.BINSERT);
			}

			this.beginStep();
			break;
		}
	}

	showChoices(x:Sort, y:Sort) {
		this.btnOne = this.items[x];
		this.btnTwo = this.items[y];
		this.btnOneFunc = function() {
			this.endStep(x, y);
		}
		this.btnTwoFunc = function() {
			this.endStep(y, x);
		}
	}

	getProgress() : string {
		if (this.worst) {
			return Math.floor(100 * this.comps / this.worst ) + '%';
		}
		return '0%';
	}

	showResults(ids:any, myResults:boolean) {
		this.btnOne = undefined;
		this.btnTwo = undefined;
		this.btnOneFunc = undefined;
		this.btnTwoFunc = undefined;
		this.done = true;
		this.encoded = undefined;

		if (myResults) {
			this.results = new Array(this.itemsLen);

			for (let i = 0; i < this.itemsLen; i += 1) {
				this.results[i] = this.items[ids[this.itemsLen - i - 1]];
			}
		}
	}

	makeUrl(isResults:boolean) {
		this.items = this.list.split('\n');
		let results = undefined;
		const nm = (isResults ? this.name : undefined);

		if (isResults) {
			results = [];
			for (let i = 0; i < this.itemsLen; i += 1) {
				results.unshift(this.items.indexOf(this.results[i]));
			}
		}

		try {
			const data = lzwCompress.pack({ items: this.items, results: results, name: nm });
			this.encoded = this.baseUrl + environment.directory + '?data=' + Base64.encode(data).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '%3D');
		}
		catch (e) {
			console.error(e);
		}
	}

}
