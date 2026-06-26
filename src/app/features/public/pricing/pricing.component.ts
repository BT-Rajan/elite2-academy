import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { StripeService } from '../../../core/services/stripe.service';

interface Plan {
  id: string; name: string; price: number;
  priceId: string; badge?: string; color: string;
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
  stripe = inject(StripeService);

  annual      = signal(false);
  checkingOut = signal('');
  error       = signal('');

  discountedPrice(plan: Plan): number {
    return this.annual() ? Math.round(plan.price * 0.8) : plan.price;
  }
  annualTotal(plan: Plan): string {
    return '$' + Math.round(plan.price * 0.8 * 12) + '/year';
  }

  plans: Plan[] = [
    {
      id: 'starter', name: 'Starter', price: 29,
      priceId: 'price_STARTER_MONTHLY', color: '#22c55e',
      highlighted: false,
      features: ['Up to 30 students','Attendance tracking','Basic skill scoring',
                 'Parent portal access','Belt progression','Email support'],
    },
    {
      id: 'growth', name: 'Growth', price: 59,
      priceId: 'price_GROWTH_MONTHLY', color: '#6366f1',
      highlighted: true, badge: 'Most popular',
      features: ['Up to 100 students','Everything in Starter','Full loyalty program',
                 'Advanced reports','Bulk notifications','Priority support'],
    },
    {
      id: 'pro', name: 'Pro', price: 99,
      priceId: 'price_PRO_MONTHLY', color: '#f59e0b',
      highlighted: false,
      features: ['Unlimited students','Everything in Growth','Multi-location support',
                 'Custom belt colours','API access','Dedicated support'],
    },
  ];

  faq = [
    { q: 'Can I try before paying?',
      a: 'Yes — all plans come with a 3-month free trial. No credit card required to start.' },
    { q: 'How does billing work?',
      a: 'Monthly or annual billing via Stripe. Cancel anytime — no lock-in contracts.' },
    { q: 'Is there a per-student fee?',
      a: 'No. One flat fee covers your entire academy regardless of how many students you have.' },
    { q: 'Can I change plans later?',
      a: 'Absolutely. Upgrade or downgrade at any time. Changes take effect on your next billing cycle.' },
    { q: 'What payment methods do you accept?',
      a: 'All major credit cards via Stripe. We do not store card details — Stripe handles everything.' },
    { q: 'Is my data secure?',
      a: 'Yes. Data is stored in Firebase with strict Firestore security rules. Encrypted in transit and at rest.' },
  ];

  tiers = [
    { icon: '🥉', name: 'Bronze', color: '#cd7f32' },
    { icon: '🥈', name: 'Silver', color: '#c0c0c0' },
    { icon: '🥇', name: 'Gold',   color: '#ffd700' },
    { icon: '💎', name: 'Platinum', color: '#818cf8' },
  ];

  rewardPreview = [
    { icon: '💸', name: '10% off next renewal', pts: 500 },
    { icon: '🎟', name: 'One free class',        pts: 300 },
    { icon: '👕', name: 'Academy merchandise',   pts: 800 },
  ];

  async checkout(plan: Plan) {
    this.checkingOut.set(plan.id); this.error.set('');
    try {
      const priceId = this.annual()
        ? plan.priceId.replace('MONTHLY', 'ANNUAL') : plan.priceId;
      await this.stripe.checkout(priceId, 'default');
    } catch (e: any) {
      this.error.set(e.message ?? 'Checkout failed. Please try again.');
    } finally { this.checkingOut.set(''); }
  }
}
