let filteredPosts = [];
let searchTerm = '';
let selectedCategory = '';

// Sort posts by date (latest first)
const sortedPosts = Array.isArray(posts) ?
    posts
        .filter(post => post && post.publishedAt)
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    : [];

// Preload the first post's image for better LCP
if (sortedPosts.length > 0 && sortedPosts[0].mainImage) {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = sortedPosts[0].mainImage;
    link.fetchPriority = 'high';
    document.head.appendChild(link);
}
const postsPerPage = 10;
let currentPage = 1;

// Initialize category filter
function initializeCategoryFilter() {
    if (!Array.isArray(posts)) return;
    
    const categories = new Set();
    posts.forEach(post => {
        if (post.categories) {
            post.categories.forEach(category => categories.add(category));
        }
    });

    const categoryFilter = document.getElementById('category-filter');
    [...categories].sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categoryFilter.appendChild(option);
    });
}

// Filter posts based on search term and category
function filterPosts() {
    if (!Array.isArray(posts)) return [];

    filteredPosts = posts.filter(post => {
        const matchesSearch = searchTerm === '' ||
            post.title.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesCategory = selectedCategory === '' ||
            (post.categories && post.categories.includes(selectedCategory));

        return matchesSearch && matchesCategory;
    });

    currentPage = 1;
    renderPosts();
}

// Event listeners
document.getElementById('search-input').addEventListener('input', (e) => {
    searchTerm = e.target.value;
    filterPosts();
});

document.getElementById('category-filter').addEventListener('change', (e) => {
    selectedCategory = e.target.value;
    filterPosts();
});

function renderPosts() {
    const grid = document.getElementById('posts-grid');
    // When searching or filtering, use filteredPosts; otherwise use sortedPosts
    const postsToRender = (searchTerm || selectedCategory) ? filteredPosts : sortedPosts;

    if (!postsToRender || postsToRender.length === 0) {
        grid.innerHTML = '<div class="text-center text-gray-500 mt-12 text-lg">No posts found</div>';
        return;
    }
    
    const startIndex = (currentPage - 1) * postsPerPage;
    const endIndex = startIndex + postsPerPage;
    const currentPosts = postsToRender.slice(startIndex, endIndex);
    
    // Remove existing pagination if present
    const existingPagination = document.querySelector('#posts-grid + div');
    if (existingPagination) {
        existingPagination.remove();
    }

    // Prioritize rendering first 3 posts
    const renderPost = (post) => `
        <a href="/blog/${post.slug.current}" class="blog-post-card">
            ${post.mainImage ? `
                <div class="sm:w-64 flex-shrink-0">
                    <img class="blog-post-image" ${post.priority ? '' : 'loading="lazy"'} src="${post.mainImage}" alt="${post.title}">
                </div>
            ` : ''}
            <div class="blog-post-content">
                <div class="flex-1">
                    ${post.categories && post.categories.length ? `
                        <div class="flex flex-wrap gap-2 mb-3">
                            ${post.categories.map(category => `
                                <span class="blog-post-tag" role="button" onclick="event.stopPropagation(); event.preventDefault(); selectCategory('${category}')">${category}</span>
                            `).join('')}
                        </div>
                    ` : ''}
                    <h3 class="blog-post-title">${post.title}</h3>
                </div>
                <div class="blog-post-meta">
                    <span>
                        ${new Date(post.publishedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}
                    </span>
                    <span class="text-gray-400 mx-2">•</span>
                    <span>${post.readingTime} min read</span>
                </div>
            </div>
        </a>
    `;

    // Mark first 3 posts as priority for eager loading
    const html = currentPosts.map((post, index) => {
        post.priority = index < 3;
        return renderPost(post);
    }).join('');
    
    grid.innerHTML = html;
    
    // Add pagination if there are more posts
    if (postsToRender.length > postsPerPage) {
        const totalPages = Math.ceil(postsToRender.length / postsPerPage);
        const paginationHtml = `
            <div class="flex justify-center gap-3 mt-8">
                ${Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => `
                    <button
                        class="px-4 py-2 rounded-lg font-medium transition-all duration-200 ${pageNum === currentPage
                            ? 'bg-primary-500 text-white shadow-soft'
                            : 'bg-white/60 backdrop-blur-sm text-gray-600/90 hover:bg-gray-50/80 shadow-sm'}"
                        onclick="changePage(${pageNum})"
                    >
                        ${pageNum}
                    </button>
                `).join('')}
            </div>
        `;
        grid.insertAdjacentHTML('afterend', paginationHtml);
    }
}

function changePage(pageNum) {
    currentPage = pageNum;
    renderPosts();
    window.scrollTo({top: 0, behavior: 'smooth'});
}

function selectCategory(category) {
    const categoryFilter = document.getElementById('category-filter');
    categoryFilter.value = category;
    selectedCategory = category;
    filterPosts();
}

filteredPosts = [...sortedPosts];
initializeCategoryFilter();

// Check URL parameters for initial category filter
const urlParams = new URLSearchParams(window.location.search);
const categoryParam = urlParams.get('category');
if (categoryParam) {
    const categoryFilter = document.getElementById('category-filter');
    categoryFilter.value = categoryParam;
    selectedCategory = categoryParam;
    filterPosts();
} else {
    renderPosts();
}

// Update current year in footer 
document.getElementById('currentYear').textContent = new Date().getFullYear();