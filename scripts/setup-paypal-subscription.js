// This script sets up PayPal subscription products and plans
// Usage: node setup-paypal-subscription.js <client_id> <client_secret> [production]

const getAccessToken = async (clientId, clientSecret, isProduction) => {
  const baseUrl = isProduction 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`PayPal auth failed: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

const createProduct = async (accessToken, isProduction) => {
  const baseUrl = isProduction 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

  const response = await fetch(`${baseUrl}/v1/catalogs/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': Date.now().toString(), // Unique request ID
    },
    body: JSON.stringify({
      name: 'TouchBase Premium',
      description: 'Premium features for TouchBase app',
      type: 'SERVICE',
      category: 'SOFTWARE',
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create product: ${await response.text()}`);
  }

  return await response.json();
}

const createPlan = async (accessToken, productId, isProduction) => {
  const baseUrl = isProduction 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

  const response = await fetch(`${baseUrl}/v1/billing/plans`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
      'PayPal-Request-Id': `${Date.now()}_plan`, // Unique request ID
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      product_id: productId,
      name: 'TouchBase Pro Monthly',
      description: 'TouchBase Pro Monthly Subscription',
      billing_cycles: [
        {
          frequency: {
            interval_unit: 'MONTH',
            interval_count: 1
          },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0, // Infinite cycles
          pricing_scheme: {
            fixed_price: {
              value: '5',
              currency_code: 'USD'
            }
          }
        }
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CANCEL',
        payment_failure_threshold: 3
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to create plan: ${await response.text()}`);
  }

  return await response.json();
}

const main = async () => {
  try {
    const [,, clientId, clientSecret, environment = 'sandbox'] = process.argv;
    const isProduction = environment === 'production';
    
    if (!clientId || !clientSecret) {
      console.error('Usage: node setup-paypal-subscription.js <client_id> <client_secret> [production]');
      console.error('');
      console.error('Examples:');
      console.error('  # Setup in sandbox (default)');
      console.error('  node setup-paypal-subscription.js <sandbox_client_id> <sandbox_client_secret>');
      console.error('');
      console.error('  # Setup in production');
      console.error('  node setup-paypal-subscription.js <prod_client_id> <prod_client_secret> production');
      process.exit(1);
    }

    console.log(`Setting up in ${isProduction ? 'production' : 'sandbox'} mode...`);
    
    console.log('Getting access token...');
    const accessToken = await getAccessToken(clientId, clientSecret, isProduction);
    
    console.log('Creating product...');
    const product = await createProduct(accessToken, isProduction);
    console.log('Product created:', product);
    
    console.log('Creating subscription plan...');
    const plan = await createPlan(accessToken, product.id, isProduction);
    console.log('Plan created:', plan);
    
    console.log('\nSetup completed successfully!');
    console.log('\nAdd these values to your environment:');
    console.log(`VITE_PAYPAL_CLIENT_ID=${clientId}`);
    console.log(`VITE_PREMIUM_PLAN_ID=${plan.id}`);
    
    if (isProduction) {
      console.log('\nNOTE: These are production credentials. Make sure to keep them secure.');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();