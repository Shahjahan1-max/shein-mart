import { Link } from "wouter";
import { Package, Facebook, Twitter, Instagram } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-16 hidden md:block">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Link href="/">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-lg">DealX Stocks</span>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground">
              Your one-stop shop for amazing deals on top products.
            </p>
            <div className="flex gap-3 mt-4">
              <Facebook className="h-5 w-5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
              <Twitter className="h-5 w-5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
              <Instagram className="h-5 w-5 text-muted-foreground hover:text-primary cursor-pointer transition-colors" />
            </div>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Shop</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/products"><span className="hover:text-primary cursor-pointer">All Products</span></Link></li>
              <li><Link href="/categories"><span className="hover:text-primary cursor-pointer">Categories</span></Link></li>
              <li><Link href="/products?sort=featured"><span className="hover:text-primary cursor-pointer">Featured</span></Link></li>
              <li><Link href="/products?sort=discount"><span className="hover:text-primary cursor-pointer">Sale</span></Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Account</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/profile"><span className="hover:text-primary cursor-pointer">My Profile</span></Link></li>
              <li><Link href="/orders"><span className="hover:text-primary cursor-pointer">My Orders</span></Link></li>
              <li><Link href="/wallet"><span className="hover:text-primary cursor-pointer">Wallet</span></Link></li>
              <li><Link href="/referrals"><span className="hover:text-primary cursor-pointer">Referrals</span></Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Support</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/support"><span className="hover:text-primary cursor-pointer">Help Center</span></Link></li>
              <li><Link href="/messages"><span className="hover:text-primary cursor-pointer">Messages</span></Link></li>
              <li><a href="mailto:support@dealstocks.com" className="hover:text-primary cursor-pointer">support@dealstocks.com</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-border mt-8 pt-6 text-center text-sm text-muted-foreground">
          <p>© 2014 DealX Stocks. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
