# Review & Testimonial System

This system allows customers to leave reviews about their tour experience with you and displays them on your tour pages.

## Quick Start

### For Publishing a Review:

1. **Receive email** with review details and pre-formatted JSON
2. **Create file** in `src/content/reviews/` (e.g., `sarah-johnson-aug2024.json`)
3. **Paste JSON** from email
4. **Customize** if needed (mark as featured, edit for privacy)
5. **Save & deploy** - review appears automatically!

### For Customers:

Send them to: `https://abisummers.com/reviews/`

Or pre-fill: `https://abisummers.com/reviews/?email=customer@example.com&tour=Montmartre+Walking+Tour&token=BOOKING_TOKEN`

---

## Features

✅ **Star Rating System** - 1-5 star visual ratings
✅ **General Company Reviews** - Reviews are about your tour guide services, not tied to specific tours
✅ **Optional Tour Name** - Customers can mention which tour they took, but it's optional
✅ **Review Submission Form** - Single page for all reviews
✅ **Verified Reviews** - Reviews from confirmed bookings are marked as "Verified"
✅ **Featured Reviews** - Highlight exceptional testimonials
✅ **Average Rating Display** - Shows overall rating across all reviews
✅ **Responsive Design** - Works beautifully on all devices
✅ **Email Notifications** - Admin and customer receive confirmation emails

## How It Works

### 1. Customer Submits a Review

Customers can submit reviews at: `/reviews/`

The form is simple and general - customers review their overall experience with your tour guide services.

The form collects:

- Customer name
- Email (not displayed publicly)
- Tour date
- Tour name (optional - they can mention which tour if they want)
- Star rating (1-5)
- Review title
- Detailed comment

### 2. Review Submission Process

When a customer submits a review:

1. **Email sent to admin** with the review details and JSON format
2. **Confirmation email sent to customer** thanking them for their feedback
3. **Manual approval required** - You decide which reviews to publish

### 3. Publishing Reviews

To publish a review, create a JSON file in `/src/content/reviews/`:

**File naming:** Use descriptive names that help you identify reviews:

- ✅ `sarah-johnson-aug2024.json`
- ✅ `michael-chen-5star.json`
- ✅ `emma-wilson-jan2025.json`
- ❌ `review1.json` or `untitled.json`

**File content:**

```json
{
  "tourName": "Montmartre Walking Tour",
  "customerName": "John Smith",
  "rating": 5,
  "title": "Amazing tour of Paris!",
  "comment": "This was the highlight of our Paris trip. Abi's knowledge and enthusiasm made every stop memorable...",
  "tourDate": "2025-02-15T10:00:00Z",
  "submittedDate": "2025-02-16T14:30:00Z",
  "verified": true,
  "featured": false
}
```

**Note:** The `tourName` field is optional. If a customer doesn't specify which tour, you can omit it or leave it as an empty string.

### 4. Review Fields Explained

| Field          | Type              | Description                                                  |
| -------------- | ----------------- | ------------------------------------------------------------ |
| `tourName`     | string (optional) | Name of the tour they took (e.g., "Montmartre Walking Tour") |
| `customerName` | string            | Customer's name (can be modified for privacy)                |
| `email`        | string (optional) | Not displayed publicly                                       |
| `rating`       | number            | 1-5 stars                                                    |
| `verified`     | boolean           | `true` for confirmed bookings, `false` otherwise             |
| `featured`     | boolean           | `true` to highlight exceptional reviews                      |

**All fields except `tourName` and `email` are required.**

### 5. Quick Checklist

Before publishing a review:

- [ ] Rating is between 1-5
- [ ] Dates are in ISO format (`2025-02-15T10:00:00Z`)
- [ ] Review is appropriate and genuine
- [ ] Customer name respects privacy if requested
- [ ] File name is descriptive
- [ ] `tourName` is optional (can be omitted)
      |`tourDate`| date | When they took the tour (ISO format: "2025-02-15T10:00:00Z") |
      |`submittedDate`| date | When the review was submitted (ISO format: "2025-02-16T14:30:00Z") |
      |`verified`| boolean |`true`for confirmed bookings,`false`otherwise |
      |`featured`| boolean |`true` to highlight exceptional reviews |

## Review Display

Reviews appear on all tour pages (they're general company reviews, not tour-specific):

- **Average rating** shown in tour info section (calculated from all reviews)
- **Reviews section** displays up to 5 most recent reviews
- **Featured reviews** have special styling (highlighted background)
- **Verified badge** for confirmed bookings
- **Tour names shown** when customers mention which tour they took
- **"Write a Review" button** links to `/reviews/`

## Components

### `<StarRating />`

Displays visual star ratings.

**Props:**

- `rating` - Number (1-5)
- `size` - "small" | "medium" | "large"
- `showNumber` - Display numeric rating
- `interactive` - Enable click to rate

**Usage:**

```astro
<StarRating rating={4.5} size="medium" showNumber={true} />
```

### `<ReviewCard />`

Displays a single review.

**Props:**

- `review` - Review data object
- `showTourName` - Display tour name (for listings)
- `tourName` - Tour name to display

**Usage:**

```astro
<ReviewCard review={reviewData} />
```

## Sending Review Requests

After a tour, send customers a link to leave a review:

**Basic link:**

```
https://abisummers.com/reviews/
```

**Pre-filled with booking info:**

```
https://abisummers.com/reviews/?email=customer@example.com&tour=Montmartre+Walking+Tour&token=BOOKING_TOKEN
```

The `token` parameter automatically marks the review as verified if it matches a valid booking.
The `tour` parameter pre-fills the tour name field.

## Managing Reviews

### Editing Reviews

Edit the JSON files in `/src/content/reviews/` directly.
**Example edits:**

```json
// Protect privacy
"customerName": "Sarah J."

// Remove email
{
  "customerName": "Sarah Johnson",
  // email removed for privacy
  "rating": 5,
  ...
}
7. **Feature strategically** - Set `"featured": true` for your top 10-15% of reviews

// Remove tour name
{
  "customerName": "John Smith",
  // tourName omitted
  "rating": 5,
  ...
}

// Edit comment
"comment": "Wonderful tour! [Minor edit: removed personal details]"
```

### Deleting Reviews

Delete the JSON file to remove a review from the site.

### Marking as Featured

Set `"featured": true` in the JSON file to highlight exceptional reviews.

### Privacy

If a customer requests name changes, edit the `customerName` field. Remove the `email` field entirely from the JSON file (it's optional).

### General vs. Specific

Reviews are general company reviews - they appear on all tour pages. Customers can optionally mention which tour they took in the `tourName` field or in their comment, but reviews aren't filtered by tour type.

## Tips

1. **Moderate reviews** - Only publish reviews that are genuine and constructive
2. **Feature diversity** - Highlight different types of positive experiences and tours
3. **Respond personally** - Consider reaching out to thank customers for detailed reviews
4. **Request reviews** - Send follow-up emails 2-3 days after tours with link to `/reviews/`
5. **Showcase variety** - Mix verified and regular reviews for authenticity
6. **Tour mentions** - Encourage customers to mention which tour they took for context

## Sample Review Files

Three sample reviews are included in `/src/content/reviews/` to demonstrate the format. Feel free to delete or modify these.

## Future Enhancements

Possible additions to consider:

- Photo uploads with reviews
- Reply functionality for tour guide responses
- Sort/filter reviews by rating or date
- Aggregate statistics dashboard
- Review reminders via automated emails
