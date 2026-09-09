import { chromium } from 'playwright';
const browser = await chromium.launch({headless:true, channel:'msedge'});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1050}});
 await page.goto('http://127.0.0.1:5178');
 await page.evaluate(async () => {
   const image = new Image();
   image.src = 'https://images.unsplash.com/photo-1721127074326-4c08c803800d?auto=format&fit=crop&w=2200&q=85';
   await image.decode();
 });
 await page.screenshot({path:'test-results/bright-home.png'});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'test-results/bright-mobile.png'});
 console.log('Internet background photo decoded successfully.');
} finally { await browser.close(); }
