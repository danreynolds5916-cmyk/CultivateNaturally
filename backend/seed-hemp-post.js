/**
 * One-time seed script: inserts the hidden hemp editorial post.
 * Run from the project root:  node backend/seed-hemp-post.js
 * Safe to re-run — uses upsert keyed on the slug.
 */

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const BlogPost = require('./models/BlogPost');

const SLUG = 'hemp-for-a-healthy-planet';

const content = `
<h2>A Brief History: The Plant We Forgot</h2>
<p>Hemp is one of humanity's oldest cultivated crops, with archaeological evidence of hemp fiber dating back over 10,000 years to ancient China and Taiwan. It spread across Central Asia, the Middle East, and eventually Europe, where it became indispensable to maritime nations. In the age of sail, hemp rope and canvas rigged virtually every ship on the ocean. The very word "canvas" derives from the Latin <em>cannabis</em>. The Magna Carta was written on hemp parchment. Early drafts of the United States Declaration of Independence were drafted on Dutch hemp paper. George Washington and Thomas Jefferson both cultivated hemp at their Virginia estates, and Jefferson reportedly smuggled improved hemp seed varieties from China to boost his harvest.</p>
<p>For most of recorded history, hemp was as universal as wheat or corn — the Swiss Army knife of the plant kingdom. So what happened?</p>
<p>In the 1930s, a convergence of commercial interests — timber companies protecting their paper monopolies, petrochemical companies guarding their plastics profits, and pharmaceutical companies shielding proprietary medicines — supported a propaganda campaign against cannabis in all its forms. The now-infamous <em>Reefer Madness</em> film of 1936 and the Marihuana Tax Act of 1937 effectively criminalized hemp alongside its psychoactive cousin. Despite the fact that industrial hemp contains negligible levels of THC (the compound responsible for cannabis's psychoactive effects), it was swept up in the same draconian laws. By 1970, the Controlled Substances Act formally listed all cannabis as Schedule I, making hemp cultivation federally illegal in the United States.</p>
<p>The rest of the world moved on. Canada, the European Union, Australia, and China never fully abandoned hemp farming. China today is the world's largest hemp producer. But the United States lost nearly a century of agricultural and industrial innovation, ceding the field entirely to petroleum-based industries.</p>
<p>The 2018 Farm Bill changed everything. By removing industrial hemp — defined as cannabis with less than 0.3% THC — from the Controlled Substances Act, Congress opened the door to a genuine hemp renaissance in America. Since then, farmers, entrepreneurs, researchers, and environmentalists have been racing to rediscover what our great-grandparents already knew. What follows is a tour of what this remarkable plant can do.</p>

<h2>Hemp as a Building Material: The House That Hemp Built</h2>
<p>If you've never heard of hempcrete, you're about to have your mind changed about what a wall can be.</p>
<p><strong>Hempcrete</strong> is a biocomposite building material made from the woody inner core of the hemp stalk — known as the "hurd" or "shiv" — mixed with a lime-based binder and water. The resulting material is lightweight, breathable, thermally excellent, and — remarkably — carbon-negative. That is not a typo. Hempcrete actually sequesters more CO&#8322; than is emitted during its entire production and transportation chain, because the hemp plant absorbs substantial carbon dioxide as it grows and that carbon is locked inside the material for the lifetime of the building.</p>
<p>Hempcrete has been in active use in construction for over two decades, with especially strong uptake in France, the United Kingdom, and increasingly in North America. Its properties make it uniquely attractive for sustainable building:</p>
<ul>
  <li><strong>Thermal mass:</strong> Hempcrete absorbs heat during the day and releases it slowly at night, stabilizing interior temperatures and significantly reducing the energy demand for heating and cooling.</li>
  <li><strong>Moisture regulation:</strong> The lime-hemp matrix is hygroscopic — it absorbs and releases moisture naturally, regulating indoor humidity and preventing the mold and dampness that plague conventional buildings. Hempcrete structures have remained structurally sound for centuries.</li>
  <li><strong>Fire resistance:</strong> Despite being plant-based, hempcrete does not readily ignite. The carbonization of the lime binder forms a protective layer that dramatically slows combustion.</li>
  <li><strong>Pest and mold resistance:</strong> The alkaline pH of the lime binder creates a hostile environment for mold, fungi, and insects, eliminating the need for chemical treatments or preservatives.</li>
  <li><strong>Lightweight:</strong> Hempcrete weighs roughly one-eighth as much as conventional concrete, reducing the structural load on foundations and allowing more economical construction.</li>
</ul>
<p>Beyond hempcrete, hemp fiber can be manufactured into thermal insulation batts (comparable in performance to mineral wool but without the health hazards of glass fibers), hemp fiberboard panels, hemp-reinforced concrete, and hemp-based roofing tiles. A single acre of hemp grown for construction can yield enough material to insulate and wall a small home while simultaneously sequestering a net 1.5 to 3.5 tonnes of CO&#8322; from the atmosphere.</p>

<h2>Hemp as Superfood: Nature's Most Complete Nutritional Profile</h2>
<p>Walk through the supplement aisle of any natural food store and you'll find hemp seeds prominently displayed — and with excellent reason. Hemp seed is one of the most nutritionally complete foods found in nature.</p>
<p><strong>Complete protein:</strong> Hemp seeds contain approximately 25–30% protein by weight. Unlike most plant proteins, hemp protein provides all nine essential amino acids that the human body cannot synthesize on its own, making it a true complete protein. The primary proteins — edestin (65%) and albumin (35%) — are highly digestible and structurally similar to human blood plasma proteins, making hemp uniquely biocompatible.</p>
<p><strong>Optimal fatty acid profile:</strong> Hemp seeds contain roughly 30% oil by weight, with an exceptionally favorable ratio of omega-6 to omega-3 fatty acids — approximately 3:1, widely regarded as close to the ideal ratio for human cardiovascular and inflammatory health. Hemp oil is also one of very few plant-based sources of gamma-linolenic acid (GLA), a rare omega-6 fatty acid with significant anti-inflammatory properties.</p>
<p><strong>Vitamins and minerals:</strong> Hemp seeds are a meaningful source of vitamin E, magnesium, phosphorus, potassium, iron, zinc, and several B vitamins including thiamine, riboflavin, niacin, B6, and folate.</p>
<p>The culinary versatility of hemp is impressive. Hemp hearts (hulled seeds) can be sprinkled on salads, stirred into yogurt, blended into smoothies, pressed into oil for salad dressings, or processed into hemp milk — a creamy, nut-free dairy alternative rich in omega fatty acids. Hemp protein powder is popular among athletes and vegans for its complete amino acid profile and its gentleness on digestion compared to soy or whey proteins.</p>
<p>Cold-pressed hemp seed oil has a pleasant, nutty flavor that works beautifully as a finishing oil or in vinaigrettes. It is not suitable for high-heat frying, but as a cold-use oil it is a genuine nutritional powerhouse.</p>
<p>From a food security standpoint, hemp is drought-tolerant, grows in a wide range of climates, and requires minimal irrigation, pesticides, or synthetic fertilizer — making it an attractive crop for a world facing growing water scarcity and soil degradation.</p>

<h2>Hemp in Textiles: Fashion's Sustainable Future</h2>
<p>The global fashion industry is one of the most polluting on earth, responsible for approximately 10% of annual global carbon emissions and consuming vast quantities of water and chemicals. Hemp offers a radically cleaner alternative to the synthetic and conventional fibers that dominate the modern wardrobe.</p>
<p>Hemp fiber extracted from the outer stalk of the plant is among the strongest natural fibers available. Hemp fabric is naturally:</p>
<ul>
  <li><strong>Durable:</strong> Hemp fibers are roughly three times stronger than cotton. Hemp garments hold their shape, resist wear, and soften beautifully with each wash rather than degrading over time.</li>
  <li><strong>Breathable and thermoregulating:</strong> Hemp fabric wicks moisture away from the body and allows airflow — cool in summer, naturally insulating in cooler conditions.</li>
  <li><strong>UV-resistant:</strong> Hemp provides natural UV protection, making it ideal for outdoor wear.</li>
  <li><strong>Antimicrobial:</strong> Hemp's natural antimicrobial properties reduce bacterial growth, keeping garments fresher between washes.</li>
  <li><strong>Fully biodegradable:</strong> Unlike polyester, nylon, or acrylic — which shed microplastics with every wash and persist in the environment for centuries — hemp fabric is entirely biodegradable at end of life.</li>
</ul>
<p>From an agricultural perspective, hemp requires no pesticides under normal growing conditions (its dense canopy shades out weeds and its terpenoids repel many pests), and it requires far less water than cotton. Cotton is one of the most pesticide-intensive crops in the world, consuming roughly 16% of all global insecticides despite being grown on only 2.5% of arable land. Hemp actually improves soil health as it grows, making it a genuinely regenerative fiber crop.</p>
<p>The soft, linen-like texture of woven hemp has become increasingly popular in sustainable fashion. Many brands now offer hemp shirts, pants, dresses, and outerwear. Hemp-cotton blends offer an even softer hand feel while retaining hemp's durability advantages.</p>

<h2>Hemp vs. Plastic: A Bio-Based Revolution</h2>
<p>Plastic pollution is one of the defining environmental crises of our time. More than 400 million tonnes of plastic are produced globally each year, and only about 9% is ever recycled. The rest accumulates in landfills, rivers, and oceans, degrading over centuries into microplastics that have now been detected in human blood, lung tissue, and breast milk.</p>
<p>Hemp-derived bioplastics, made from cellulose extracted from hemp stalks and fiber, offer a compelling alternative:</p>
<ul>
  <li><strong>Renewable:</strong> Hemp is an annual crop, harvestable within 90–120 days and immediately replantable — unlike petroleum, which took millions of years to form.</li>
  <li><strong>Biodegradable:</strong> Hemp cellulose bioplastics can be formulated to decompose in commercial composting facilities within months, versus centuries for conventional plastic.</li>
  <li><strong>Strong and lightweight:</strong> Hemp fiber composites are used in automotive manufacturing — BMW, Mercedes-Benz, and Audi have incorporated hemp-fiber panels in interior components — to reduce vehicle weight and improve fuel efficiency without sacrificing structural performance.</li>
  <li><strong>Non-toxic:</strong> Hemp-based plastics do not leach BPA, phthalates, or other endocrine-disrupting chemicals found in many conventional plastic products.</li>
</ul>
<p>Henry Ford, the founder of the American auto industry, was a champion of hemp-based materials long before the prohibition era shelved the conversation. In 1941 he unveiled a prototype car with body panels made from hemp and other plant-derived plastics — panels reportedly ten times more impact-resistant than steel. Ford's vision of a car "grown from the soil" was abandoned after hemp's criminalization. Modern researchers and manufacturers are now reviving it with new precision and urgency.</p>

<h2>Hemp as Biofuel: Growing Our Own Energy</h2>
<p>Hemp offers two distinct pathways to bio-based energy, both of which are technically mature and commercially viable.</p>
<p><strong>Hemp biodiesel</strong> is produced by converting cold-pressed hemp seed oil through transesterification — the same process used for soy or canola biodiesel. Hemp biodiesel can power diesel engines without modification and produces significantly lower emissions of carbon monoxide, particulate matter, and net CO&#8322; compared to petroleum diesel.</p>
<p><strong>Cellulosic ethanol</strong> can be produced by fermenting and distilling the cellulose and hemicellulose in hemp stalks and hurds. Hemp's exceptionally high cellulose content makes it one of the most efficient feedstocks for ethanol production. Unlike corn-based ethanol, which competes with food production and requires intensive fertilizer inputs, hemp can be grown on marginal land and actually improves soil quality in the process.</p>
<p>Hemp biofuels will not single-handedly replace fossil fuels — no single solution can. But as part of a diversified renewable energy portfolio alongside wind, solar, and other renewables, hemp contributes a meaningful piece to the energy transition puzzle.</p>

<h2>Hemp for Soil and the Environment: Nature's Cleanup Crew</h2>
<p>Industrial hemp is a <em>phytoremediator</em> — it actively extracts heavy metals and industrial pollutants from contaminated soil through its root system. This extraordinary capability has been documented at industrial contamination sites around the world.</p>
<p>Most famously, hemp was planted near the Chernobyl nuclear disaster site in Ukraine to help absorb cesium-137 and strontium-90 from the soil — a process confirmed effective in multiple scientific studies. Hemp has also successfully remediated soils contaminated with cadmium, lead, nickel, zinc, and petroleum residues at industrial brownfield sites.</p>
<p>Beyond remediation, hemp's environmental profile is outstanding across almost every dimension:</p>
<ul>
  <li><strong>Carbon sequestration:</strong> Hemp absorbs CO&#8322; at rates roughly twice that of forests per hectare, storing carbon in its biomass, root system, and in long-lived products made from it.</li>
  <li><strong>Soil health:</strong> Hemp's deep taproot system — roots can penetrate six feet or more into the earth — breaks up compacted soil, improves drainage, and returns organic matter and nutrients as it decomposes. Hemp is widely used as a rotation crop to regenerate exhausted agricultural land.</li>
  <li><strong>Biodiversity:</strong> Organically grown hemp fields support a rich diversity of pollinators, birds, and beneficial soil microorganisms that monoculture pesticide-intensive crops systematically destroy.</li>
  <li><strong>Water efficiency:</strong> Hemp requires significantly less water than cotton and most other commercial crops, making it far more appropriate for water-stressed agricultural regions.</li>
</ul>

<h2>Hemp in Medicine and Wellness: A Long History of Healing</h2>
<p>Cannabis has been used therapeutically for at least 5,000 years. Records of its medicinal use appear in ancient Chinese, Indian, Egyptian, Greek, and Arab medical traditions. The modern understanding of why cannabis works began in the 1990s with the discovery of the human <strong>endocannabinoid system</strong> — a complex network of receptors and signaling molecules found throughout the brain, nervous system, and immune system that regulates mood, pain, inflammation, sleep, appetite, memory, and immune function.</p>
<p>The cannabinoids in hemp — most notably <strong>cannabidiol (CBD)</strong> — interact with this system in ways that are increasingly well documented by science:</p>
<ul>
  <li><strong>Anti-inflammatory effects:</strong> CBD is among the most thoroughly studied plant-based anti-inflammatory compounds, modulating immune responses by inhibiting pro-inflammatory cytokines and acting on pain perception receptors.</li>
  <li><strong>Anxiety reduction:</strong> Multiple clinical studies and a large body of preclinical research support CBD's anxiolytic properties, acting through serotonin receptors and the endocannabinoid system.</li>
  <li><strong>Epilepsy treatment:</strong> Epidiolex — a pharmaceutical-grade CBD oil — became the first cannabis-derived medicine to receive FDA approval, in 2018, for two severe pediatric epilepsy conditions (Dravet syndrome and Lennox-Gastaut syndrome). The evidence for CBD's anticonvulsant effects is among the strongest in plant medicine.</li>
  <li><strong>Skin health:</strong> Hemp seed oil's rich profile of omega fatty acids, vitamin E, and phytosterols makes it a powerful skin-nourishing ingredient. It is non-comedogenic (does not clog pores) and has demonstrated anti-inflammatory effects relevant to eczema, acne, rosacea, and general skin aging.</li>
  <li><strong>Sleep support:</strong> Preliminary research suggests that CBD and minor cannabinoids may help regulate the sleep-wake cycle, with potential benefits for people with insomnia or disrupted circadian rhythms.</li>
</ul>
<p>Hemp-derived CBD products are wellness supplements, not medications, and should not be presented as cures for disease. But the science is real, the research is growing, and hemp-derived compounds represent one of the most exciting frontiers in plant-based health.</p>

<h2>Hemp Paper: Saving the Forests One Page at a Time</h2>
<p>Paper production is a leading driver of global deforestation. Each year, millions of acres of forest — including old-growth and biodiverse ecosystems — are cleared to feed demand for wood pulp. Hemp offers a dramatically more efficient alternative.</p>
<p>One acre of hemp can produce as much paper-quality cellulose fiber as two to four acres of trees — and in a single growing season, compared to the 20 to 100 years required for trees to reach harvestable size. Hemp paper is stronger and longer-lasting than wood-pulp paper; it yellows far more slowly, which is why the world's most ancient surviving documents — including early Gutenberg Bibles — were printed on hemp-based paper.</p>
<p>Hemp paper production also requires fewer chemicals and less processing than conventional wood-pulp papermaking, resulting in lower water pollution from bleaching and pulping processes. If even a meaningful fraction of global paper demand shifted to hemp-based fiber, the reduction in deforestation pressure would be substantial.</p>

<h2>Hemp Rope, Composites, and Industrial Fiber</h2>
<p>Long before synthetic polymers gave us nylon, polyester, and Kevlar, hemp rope was the gold standard of industrial cordage. The rigging of tall ships, harbor hawsers, and suspension bridge cables all relied on hemp's tensile strength and salt-water resistance.</p>
<p>Today hemp fiber is finding modern industrial applications beyond traditional rope:</p>
<ul>
  <li><strong>Geotextiles:</strong> Hemp fiber mats are used in erosion control, slope stabilization, and ecological restoration. They are strong enough to hold soil in place during the establishment of new vegetation, yet biodegradable enough to dissolve into the earth without leaving chemical residue.</li>
  <li><strong>Composites:</strong> Hemp fiber-reinforced composites are used in automotive, aerospace, marine, and construction industries. Hemp-fiber composites offer a favorable strength-to-weight ratio, excellent vibration damping properties, and a dramatically lower carbon footprint than fiberglass or carbon fiber.</li>
  <li><strong>Animal bedding:</strong> Hemp hurds — the woody core of the hemp stalk remaining after fiber extraction — are highly absorbent, virtually dust-free, and far superior to straw as bedding for horses and small animals. They compost readily after use.</li>
</ul>

<h2>Hemp in Cosmetics and Personal Care</h2>
<p>The beauty and personal care industry has embraced hemp enthusiastically — and the science supports the enthusiasm. Hemp seed oil and CBD have become sought-after ingredients in high-performance skincare.</p>
<p>Hemp seed oil is rich in linoleic acid and alpha-linolenic acid (essential fatty acids that maintain the skin's lipid barrier and reduce moisture loss), gamma-linolenic acid (anti-inflammatory), vitamin E (antioxidant), and phytosterols (which support cellular health and reduce inflammation).</p>
<p>These properties make hemp seed oil beneficial for virtually all skin types: acne-prone skin (linoleic acid deficiency is associated with acne), dry and mature skin (deeply nourishing without clogging pores), and sensitive or inflamed conditions like eczema and rosacea. Hemp-based products on the market today include facial moisturizers, serums, eye creams, lip balms, shampoos, conditioners, body washes, and healing salves.</p>
<p>Many sustainable cosmetic brands are turning to hemp as a plant-based, ethically grown alternative to palm oil and petroleum-derived cosmetic ingredients — a shift that benefits both consumers and ecosystems.</p>

<h2>The Bigger Picture: What Hemp Means for the Planet</h2>
<p>Step back and consider what a world that fully embraces hemp could look like.</p>
<p>Buildings insulated and constructed with hempcrete that absorb carbon from the atmosphere over their entire lifetime. Clothing made from fibers that grow without pesticides, strengthen rather than degrade with washing, and return to the earth at end of life instead of persisting as microplastics. Packaging and single-use containers that decompose in months rather than centuries. Food that provides complete nutrition from a crop that regenerates the soil it grows in. Medicines and wellness products derived from a plant that has been used safely by billions of people across thousands of years of human history.</p>
<p>This is not utopian fantasy. All of these applications exist today, at commercial scale, in countries that never abandoned hemp. The barriers that remain in the United States and elsewhere are not scientific or practical — they are political, historical, and rooted in a century of misinformation.</p>
<p>Hemp will not solve climate change on its own. But it is a genuinely remarkable tool: one that is better for the environment, for human health, for agricultural sustainability, and for economic resilience across nearly every dimension that matters. That is extraordinarily rare in a world of difficult trade-offs.</p>

<h2>Supporting the Movement: NORML and the Path Forward</h2>
<p>The hemp renaissance is underway, but the work is far from complete. Legal and regulatory barriers still hamper hemp farming and product development in many regions. Banking restrictions limit access to financial services for hemp businesses. International drug treaties create obstacles to global hemp trade. And decades of stigma — the legacy of misguided prohibition — continue to cloud public understanding of the difference between industrial hemp and marijuana.</p>
<p>This is where advocacy matters, and where <strong>NORML</strong> plays a critical role.</p>
<p>The <strong>National Organization for the Reform of Marijuana Laws</strong> has been fighting for rational, evidence-based cannabis policy since 1970 — longer than any other organization in the movement. Their mission spans the full spectrum of cannabis reform: protecting individual rights, ending mass incarceration for cannabis-related offenses, advocating for hemp farmers' freedom to grow and sell without bureaucratic obstruction, and building an equitable legal framework for cannabis commerce that serves communities — especially those most harmed by decades of disproportionate enforcement.</p>
<p>NORML's work has contributed directly to the legislative reforms that made the 2018 Farm Bill possible. They lobby at federal and state levels, publish peer-reviewed research, train local advocates through chapters across the country, and serve as the public face of evidence-based cannabis law reform. Supporting NORML means supporting a future where hemp can reach its full potential — in your home, on your plate, in your wardrobe, and in the soil beneath your feet.</p>
<blockquote style="border-left:4px solid #748a53;padding:.75rem 1.25rem;margin:1.5rem 0;background:#f8fdf4;font-style:italic;color:#444">
  "The earth laughs in flowers." — Ralph Waldo Emerson. We believe the earth also grows in hemp.
</blockquote>
<p>You can support NORML by visiting <a href="https://norml.org" target="_blank" rel="noopener noreferrer" style="color:#748a53;font-weight:600">norml.org</a>, joining as a member, donating to their legal defense and advocacy fund, or simply following and sharing their educational resources with your community. Every voice matters in building a world where this remarkable plant is finally free to do what it does best.</p>

<h2>Conclusion: The Plant We Need, Right Now</h2>
<p>Industrial hemp is not a silver bullet. No single material or crop can reverse the environmental damage of the past century or resolve the interlocking challenges of climate change, resource depletion, and social inequality. But hemp occupies a genuinely rare position: it is better along almost every dimension that matters. Better for the atmosphere, better for the soil, better for water, better for human health, better for the communities that grow it, and better for the generations that will inherit the planet we leave behind.</p>
<p>Every building insulated with hemp fiber instead of fiberglass is a small victory against energy waste. Every hemp garment chosen over a fast-fashion polyester item is a small vote against microplastic pollution. Every serving of hemp protein in a morning smoothie is a small step toward a food system less dependent on industrial animal agriculture. Every hemp composite panel displacing fiberglass in a car door is a small reduction in petroleum demand.</p>
<p>Small steps, multiplied by millions of informed choices and supported by coherent policy, become transformations. The perfect plant for a healthy planet has been waiting patiently for us to catch up.</p>
<p>The time to embrace it is now.</p>
<hr style="border:none;border-top:2px solid #e8ede0;margin:2.5rem 0">
<p style="font-size:.9rem;color:#666;font-style:italic">In support of <a href="https://norml.org" target="_blank" rel="noopener noreferrer" style="color:#748a53">NORML</a> and the continued reform of cannabis laws — because the environment, our health, and our communities deserve better. Learn more and get involved at <strong>norml.org</strong>.</p>
`;

(async () => {
    try {
        const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/hamadryad';
        await mongoose.connect(uri);
        console.log('Connected to MongoDB.');

        const post = await BlogPost.findOneAndUpdate(
            { slug: SLUG },
            {
                title: 'The Perfect Plant for a Healthy Planet',
                slug: SLUG,
                excerpt: 'Hemp can be made into everything from fuel and plastics to hempcrete, superfood, and clothing. Discover why cannabis sativa is the most versatile and environmentally beneficial crop on earth — and why its renaissance matters for all of us.',
                content: content.trim(),
                status: 'draft',          // hidden from blog listing — accessible only by direct URL
                category: 'Education',
                tags: ['hemp', 'sustainability', 'environment', 'CBD', 'hempcrete', 'bioplastics', 'NORML', 'cannabis'],
                author: 'Cultivate Naturally',
                featuredImage: '',
                metaTitle: 'The Perfect Plant for a Healthy Planet | Cultivate Naturally',
                metaDescription: 'Hemp can be made into everything from biofuel and plastic alternatives to hempcrete, superfood, and sustainable clothing. A deep dive into the most versatile plant on earth.'
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        console.log('\n✅ Hemp post saved successfully.');
        console.log('   ID   :', post._id);
        console.log('   Slug :', post.slug);
        console.log('   Status:', post.status);
        console.log('\n   Access via: BlogPost.html?id=' + post.slug);
    } catch (err) {
        console.error('Error seeding hemp post:', err.message);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
})();
