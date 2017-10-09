import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { RevealerComponent } from './revealer.component';

@NgModule({
	imports: [
		CommonModule,
		FormsModule,
		RouterModule
	],
	declarations: [
		RevealerComponent
	],
	providers: [
	],
	exports: [
		RevealerComponent
	]
})
export class RevealerModule { }
