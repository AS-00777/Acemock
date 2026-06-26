import React, { useState } from 'react';

export type CompanyLogoKey =
  | 'tcs'
  | 'tata'
  | 'infosys'
  | 'accenture'
  | 'cognizant'
  | 'wipro'
  | 'capgemini'
  | 'hcl'
  | 'techMahindra'
  | 'ibm'
  | 'deloitte'
  | 'oracle';

export const companyLogos: Record<CompanyLogoKey, string> = {
  tcs: '/company-logos/tata-consultancy-services-logo.svg',
  tata: '/company-logos/Tata_logo.svg',
  infosys: '/company-logos/INFY.svg',
  accenture: '/company-logos/ACN_BIG.svg',
  cognizant: '/company-logos/CTSH_BIG.svg',
  wipro: '/company-logos/WIT.svg',
  capgemini: '/company-logos/CAP.PA_BIG.svg',
  hcl: '/company-logos/HCLTECH.NS.svg',
  techMahindra: '/company-logos/TECHM.NS_BIG.svg',
  ibm: '/company-logos/IBM_logo.svg',
  deloitte: '/company-logos/deloitte_BIG.svg',
  oracle: '/company-logos/ORCL_BIG.svg',
};

export const companyLogoFallbacks: Record<CompanyLogoKey, string> = {
  tcs: 'TCS',
  tata: 'Tata',
  infosys: 'Infosys',
  accenture: 'Accenture',
  cognizant: 'Cognizant',
  wipro: 'Wipro',
  capgemini: 'Capgemini',
  hcl: 'HCL',
  techMahindra: 'TechM',
  ibm: 'IBM',
  deloitte: 'Deloitte',
  oracle: 'Oracle',
};

export const routeCompanyToLogoKey: Record<string, CompanyLogoKey> = {
  tcs: 'tcs',
  'tcs-digital': 'tata',
  infosys: 'infosys',
  accenture: 'accenture',
  cognizant: 'cognizant',
  wipro: 'wipro',
  capgemini: 'capgemini',
  hcl: 'hcl',
  'tech-mahindra': 'techMahindra',
  ibm: 'ibm',
  deloitte: 'deloitte',
  oracle: 'oracle',
};

export const CompanyLogo: React.FC<{
  src?: string;
  alt: string;
  variant: 'menu' | 'header' | 'overview';
  fallback: string;
  active?: boolean;
}> = ({ src, alt, variant, fallback, active = false }) => {
  const [failed, setFailed] = useState(false);

  const shell = `company-logo-wrap company-logo-wrap--${variant} ${
    active
      ? 'company-logo-wrap--active'
      : ''
  }`;

  if (!src || failed) {
    return (
      <span className={`${shell} company-logo-fallback`} aria-label={alt}>
        {fallback}
      </span>
    );
  }

  return (
    <span className={shell}>
      <img
        src={src}
        alt={alt}
        className="company-logo-img"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </span>
  );
};
