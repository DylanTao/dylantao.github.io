/**
 * SEO Optimization Script for Academic Website
 * Enhances search engine visibility and user experience
 */

(function() {
    'use strict';

    // SEO Performance Monitoring
    const seoMetrics = {
        pageLoadTime: 0,
        userEngagement: 0,
        scrollDepth: 0
    };

    // Performance Monitoring
    function monitorPerformance() {
        if ('performance' in window) {
            window.addEventListener('load', function() {
                const perfData = performance.getEntriesByType('navigation')[0];
                seoMetrics.pageLoadTime = perfData.loadEventEnd - perfData.loadEventStart;
                
                // Send performance data to analytics
                if (typeof gtag !== 'undefined') {
                    gtag('event', 'timing_complete', {
                        name: 'page_load',
                        value: Math.round(seoMetrics.pageLoadTime)
                    });
                }
            });
        }
    }

    // Lazy Loading for Images
    function initLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        img.src = img.dataset.src;
                        img.classList.remove('lazy');
                        imageObserver.unobserve(img);
                    }
                });
            });

            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        }
    }

    // Enhanced Meta Tags
    function enhanceMetaTags() {
        // Add structured data for current page
        const currentPage = window.location.pathname;
        
        if (currentPage.includes('/publications/') || currentPage.includes('/projects/')) {
            addPublicationSchema();
        } else if (currentPage.includes('/blog/')) {
            addBlogPostSchema();
        }
    }

    // Add Publication Schema
    function addPublicationSchema() {
        const schema = {
            "@context": "https://schema.org",
            "@type": "CreativeWork",
            "name": document.title,
            "description": getMetaDescription(),
            "author": {
                "@type": "Person",
                "name": "Sirui Tao"
            },
            "publisher": {
                "@type": "Person",
                "name": "Sirui Tao"
            },
            "url": window.location.href,
            "datePublished": new Date().toISOString().split('T')[0],
            "genre": "Research Publication"
        };

        addStructuredData(schema);
    }

    // Add Blog Post Schema
    function addBlogPostSchema() {
        const schema = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": document.title,
            "description": getMetaDescription(),
            "author": {
                "@type": "Person",
                "name": "Sirui Tao"
            },
            "publisher": {
                "@type": "Person",
                "name": "Sirui Tao"
            },
            "url": window.location.href,
            "datePublished": new Date().toISOString().split('T')[0],
            "mainEntityOfPage": {
                "@type": "WebPage",
                "@id": window.location.href
            }
        };

        addStructuredData(schema);
    }

    // Add Structured Data to Page
    function addStructuredData(schema) {
        const script = document.createElement('script');
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);
    }

    // Get Meta Description
    function getMetaDescription() {
        const metaDesc = document.querySelector('meta[name="description"]');
        return metaDesc ? metaDesc.content : document.title;
    }

    // User Engagement Tracking
    function trackUserEngagement() {
        let scrollDepth = 0;
        let lastScrollTop = 0;

        window.addEventListener('scroll', function() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const docHeight = document.documentElement.scrollHeight - window.innerHeight;
            const scrollPercent = Math.round((scrollTop / docHeight) * 100);

            if (scrollPercent > scrollDepth) {
                scrollDepth = scrollPercent;
                
                // Track scroll depth milestones
                if (scrollDepth >= 25 && scrollDepth < 50) {
                    trackScrollMilestone('25%');
                } else if (scrollDepth >= 50 && scrollDepth < 75) {
                    trackScrollMilestone('50%');
                } else if (scrollDepth >= 75 && scrollDepth < 100) {
                    trackScrollMilestone('75%');
                } else if (scrollDepth >= 100) {
                    trackScrollMilestone('100%');
                }
            }
        });

        // Track time on page
        let startTime = Date.now();
        window.addEventListener('beforeunload', function() {
            const timeOnPage = Math.round((Date.now() - startTime) / 1000);
            if (typeof gtag !== 'undefined') {
                gtag('event', 'timing_complete', {
                    name: 'time_on_page',
                    value: timeOnPage
                });
            }
        });
    }

    // Track Scroll Milestones
    function trackScrollMilestone(milestone) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'scroll_depth', {
                event_category: 'engagement',
                event_label: milestone,
                value: milestone
            });
        }
    }

    // Enhanced Search Functionality
    function enhanceSearch() {
        const searchInput = document.querySelector('#search-input');
        if (searchInput) {
            // Add search suggestions
            searchInput.addEventListener('input', function(e) {
                const query = e.target.value;
                if (query.length > 2) {
                    showSearchSuggestions(query);
                }
            });

            // Track search queries
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    trackSearchQuery(e.target.value);
                }
            });
        }
    }

    // Show Search Suggestions
    function showSearchSuggestions(query) {
        // Implementation for search suggestions
        // This could integrate with your existing search functionality
    }

    // Track Search Queries
    function trackSearchQuery(query) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'search', {
                search_term: query
            });
        }
    }

    // Social Media Enhancement
    function enhanceSocialMedia() {
        // Add social sharing buttons if not present
        const socialButtons = document.querySelector('.social-share');
        if (!socialButtons) {
            addSocialShareButtons();
        }
    }

    // Add Social Share Buttons
    function addSocialShareButtons() {
        const shareContainer = document.createElement('div');
        shareContainer.className = 'social-share mt-3';
        shareContainer.innerHTML = `
            <h6>Share this page:</h6>
            <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(document.title)}" 
               target="_blank" class="btn btn-sm btn-outline-primary me-2">
               <i class="fab fa-twitter"></i> Twitter
            </a>
            <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}" 
               target="_blank" class="btn btn-sm btn-outline-primary me-2">
               <i class="fab fa-linkedin"></i> LinkedIn
            </a>
            <a href="mailto:?subject=${encodeURIComponent(document.title)}&body=${encodeURIComponent(window.location.href)}" 
               class="btn btn-sm btn-outline-primary">
               <i class="fas fa-envelope"></i> Email
            </a>
        `;

        // Insert after the main content
        const mainContent = document.querySelector('main') || document.querySelector('.container');
        if (mainContent) {
            mainContent.appendChild(shareContainer);
        }
    }

    // Initialize SEO Features
    function initSEO() {
        monitorPerformance();
        initLazyLoading();
        enhanceMetaTags();
        trackUserEngagement();
        enhanceSearch();
        enhanceSocialMedia();
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSEO);
    } else {
        initSEO();
    }

    // Export for global access
    window.seoOptimization = {
        metrics: seoMetrics,
        init: initSEO
    };

})();
