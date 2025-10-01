const { BOOKEO_CLIENT, BOOKEO_SERVER } = import.meta.env;

interface BookeoProductsResponse {
  data: BookeoProduct[];
  info: {
    page: number;
    pageSize: number;
    totalEntries: number;
    totalPages: number;
  };
}

export type BookeoProduct = {
  /**
   * The title of the guide
   */
  name: string;
  /**
   * HTML description
   */
  description: string;
  /**
   * The unique identifier of the product (used in the booking widget)
   * e.g. "3252MKCWA4193B1401C92"
   */
  productId: string;
  /**
   * The unique slug of the product (used in the URL)
   * e.g. "visit-paris"
   */
  productCode: string;
  /**
   * Images associated with the product
   */
  images: {
    url: string;
  }[];
  /**
   * Duration of the product
   */
  duration: {
    days: number;
    hours: number;
    minutes: number;
  };
  /**
   * Pricing add-ons
   */
  defaultRates?: {
    peopleCategoryId?: string;
    price: {
      amount: string;
      currency: string;
    };
  }[];
  /**
   * Booking limits (min/max people)
   */
  bookingLimits?: {
    peopleCategoryId?: string;
    min: number;
    max: number;
  }[];
  /**
   * Product type
   */
  type?: string;
  /**
   * Whether members only
   */
  membersOnly?: boolean;
  /**
   * Additional number options (like extra hours)
   */
  numberOptions?: {
    minValue: number;
    maxValue: number;
    defaultValue: number;
    id: string;
    name: string;
    index: number;
    description?: string;
    shownToCustomers: boolean;
    enabled: boolean;
  }[];
  /**
   * Text input options for customization
   */
  textOptions?: {
    required: boolean;
    id: string;
    name: string;
    index: number;
    description?: string;
    shownToCustomers: boolean;
    enabled: boolean;
  }[];
};

type BasePrice = {
  amount: string;
  currency: string;
};
const PRODUCT_BASE_PRICE_MAPPING: Record<string, BasePrice> = {
  "visit-paris": { amount: "240", currency: "EUR" },
  montmartre: { amount: "180", currency: "EUR" },
  "pere-lachaise": { amount: "170", currency: "EUR" },
  "ile-de-la-cite": { amount: "150", currency: "EUR" },
};

export async function getProductsWithPricing(): Promise<
  Omit<BookeoProductsResponse, "data"> & {
    data: (BookeoProduct & {
      basePrice?: BasePrice;
    })[];
  }
> {
  const { data, info } = await getProducts();

  const productsWithPricing = await Promise.all(
    data.map((product) => {
      return {
        ...product,
        basePrice: PRODUCT_BASE_PRICE_MAPPING[product.productCode],
      };
    }),
  );

  return { data: productsWithPricing, info };
}

export async function getProducts(): Promise<BookeoProductsResponse> {
  const { data, info } = (await fetch(
    `https://api.bookeo.com/v2/settings/products?apiKey=${BOOKEO_CLIENT}&secretKey=${BOOKEO_SERVER}`,
  )
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(
          `Failed to fetch products: ${res.status} ${res.statusText} ${await res.text()}`,
        );
      }
      return res;
    })
    .then((res) => res.json())) as BookeoProductsResponse;

  return { data, info };
}
