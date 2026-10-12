import React from "react";
import { ChevronRight, Home } from "lucide-react";
import { breadcrumbListSchema, jsonLdToScript } from "../../lib/seo/jsonld";

export interface BreadcrumbItem {
  name?: string;
  label?: string;
  path?: string;
  href?: string;
}

export interface BreadcrumbItemDef {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items?: (BreadcrumbItem | BreadcrumbItemDef)[];
  path?: string;
}

function parsePathToItems(path: string): BreadcrumbItem[] {
  const segments = path.split("/").filter(Boolean);
  const items: BreadcrumbItem[] = [];
  let current = "";
  for (const seg of segments) {
    current += `/${seg}`;
    const label = seg
      .replace(/-/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
    items.push({ name: label, label, path: current, href: current });
  }
  return items;
}

export function Breadcrumbs({ items, path }: BreadcrumbsProps) {
  const parsedItems = items || (path ? parsePathToItems(path) : []);
  const normalized = parsedItems.map((item: any) => ({
    label: String(item.label || item.name || ""),
    href: String(item.href || item.path || ""),
  }));
  const fullItems = [{ label: "Home", href: "/" }, ...normalized];

  const jsonLdData = breadcrumbListSchema(
    fullItems.map(item => ({
      name: item.label,
      path: item.href,
    }))
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdToScript(jsonLdData) }}
      />
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center space-x-2 text-xs text-gray-400">
        {fullItems.map((item, index) => {
          const isLast = index === fullItems.length - 1;
          return (
            <React.Fragment key={index}>
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-gray-600" />}
              {isLast || !item.href ? (
                <span className="font-medium text-gray-200 truncate max-w-[200px] sm:max-w-none">
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="flex items-center gap-1 hover:text-purple-400 transition-colors"
                >
                  {index === 0 && <Home className="h-3 w-3 text-gray-500" />}
                  <span>{item.label}</span>
                </a>
              )}
            </React.Fragment>
          );
        })}
      </nav>
    </>
  );
}