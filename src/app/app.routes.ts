import { Routes, RouterModule } from '@angular/router';
import { RevealerComponent } from './revealer/revealer.component';


export const routes: Routes = [
	{ path: '', component: RevealerComponent }
];

export const appRoutingProviders: any[] = [

];

export const routing = RouterModule.forRoot(routes);
