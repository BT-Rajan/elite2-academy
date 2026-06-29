import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

interface Plan {
  id: string; name: string; price: number;
  badge?: string; color: string;
  features: string[]; highlighted: boolean;
}

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './pricing.component.html',
  styleUrls: ['./pricing.component.scss']
})
export class PricingComponent {
  auth   = inject(AuthService);
  annual = signal(false);
  checkingOut = signal('');
  error  = signal('');

  discountedPrice(plan: Plan): number {
    return this.annual() ? Math.round(plan.price * 0.8) : plan.price;
  }
  annualTotal(plan: Plan): string {
    return '$' + Math.round(plan.price * 0.8 * 12) + '/year';
  }

  plans: Plan[] = [
    { id: 'starter', name: 'Starter', price: 29, color: '#22c55e', highlighted: false,
      features: ['Up to 30 students','Attendance tracking','Basic skill scoring',
                 'Parent portal access','Belt progression','Email support'] },
    { id: 'growth', name: 'Growth', price: 59, color: '#6366f1', highlighted: true, badge: 'Most popular',
      features: ['Up to 100 students','Everything in Starter','Full loyalty program',
                 'Advanced reports','Bulk notifications','Priority support'] },
    { id: 'pro', name: 'Pro', price: 99, color: '#f59e0b', highlighted: false,
      features: ['Unlimited students','Everything in Growth','Multi-location support',
                 'Custom belt colours','API access','Dedicated support'] },
  ];

  faq = [
    { q: 'Can I try before paying?',       a: 'Yes — all plans come with a 3-month free trial. No credit card required to start.' },
    { q: 'How does billing work?',          a: 'Monthly or annual billing via bank transfer or card. Cancel anytime.' },
    { q: 'Is there a per-student fee?',    a: 'No. One flat fee covers your entire academy regardless of student count.' },
    { q: 'Can I change plans later?',      a: 'Absolutely. Upgrade or downgrade at any time.' },
    { q: 'What payment methods do you accept?', a: 'Bank transfer, credit card, or UPI. Contact us to set up billing.' },
    { q: 'Is my data secure?',             a: 'Yes. All data is stored on your own XAMPP server with JWT authentication.' },
  ];

  async checkout(plan: Plan) {
    this.checkingOut.set(plan.id);
    // Contact admin to set up billing — no Stripe
    window.location.href = `mailto:admin@yourdojo.com?subject=Subscription: ${plan.name} Plan`;
    setTimeout(() => this.checkingOut.set(''), 1000);
  }
}
