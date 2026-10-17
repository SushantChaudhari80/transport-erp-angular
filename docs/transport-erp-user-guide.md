# Transport ERP
## Client overview and user guide

Transport ERP brings transport, fleet, trip, machine-reading, and finance
workflows together in one workspace. Use the web application to manage
day-to-day operations and reporting, and the companion Android application to
give drivers access to the work and records relevant to them.

> **Screenshots:** Screenshot markers throughout this guide are placeholders.
> Add approved product screenshots in these locations before sharing a
> screenshot-filled edition with clients. Do not include real customer, driver,
> payment, or vehicle personal information in public marketing material.

---

## At a glance

| Area | What you can do |
| --- | --- |
| Dashboard | Review operating summaries and open common work areas. |
| Orders | Create, review, update, filter, and manage customer orders and assigned vehicles. |
| Fleet | Maintain vehicle and driver records and review vehicle activity. |
| Trips | Record trips, review billed and unbilled trips, and prepare invoices from eligible trips. |
| Machine readings | Review machine readings, monitor billed status, and prepare invoices from unbilled readings. |
| Finance | Review customer payments, driver payments, diesel records, vouchers, and invoices. |
| Portfolio | Review a customer's orders and activity with date and order-level filtering. |
| Support | Record incidents, update their status, and keep comments in a shared thread. |
| Driver app | Let drivers sign in, see their assigned work, submit trips and readings, and manage their own operational records. |

## Getting started

1. Open the Transport ERP sign-in screen.
2. Enter the account credentials supplied by your administrator and select
   **Sign In**. Use **Show** or **Hide** if you need to check the password you
   entered.
3. Use the navigation menu to open the module you need. On smaller screens,
   open or collapse the menu using the menu button.
4. Use the account menu to review available profile information or sign out.

The menu is grouped into Overview, Fleet operations, Utilities, and Finance &
reports. A floating **Chat** control is available in the signed-in workspace.
The current chat is a demonstration assistant with generic responses; it is
not yet connected to an operational support or AI chat service.

**Screenshot placeholder — Sign-in screen**

**Screenshot placeholder — Dashboard and navigation**

---

## Web application guide

### 1. Dashboard

The dashboard provides a quick operational overview, including total orders,
vehicles in use, active deliveries, pending issues, completed deliveries, and
diesel consumption. Shortcuts open Orders, Vehicles, Drivers, Trips, and
Quotation.

If dashboard data cannot be loaded, use **Retry** in the error message. Select
**View orders** or **Open orders** to go directly to order management.

**Screenshot placeholder — Dashboard KPI cards and module shortcuts**

### 2. Orders

Orders represent customer work and its delivery requirements.

- Review the order list and refresh it when needed.
- Filter by order status or a date range; choose **Apply Filters** to apply
  the selection or **Clear** to reset it.
- Open an order to review its details.
- Create an order with customer and delivery details and assign one or more
  vehicles.
- Update an existing order's details and vehicle assignments.
- Use the available order actions to manage records, subject to the account's
  permissions and the order's current state.

**Typical workflow:** Select **Add New Order**, enter the customer and order
information, choose the vehicle or vehicles, review the details, and save.

**Screenshot placeholder — Order list and filters**

**Screenshot placeholder — Create or update an order and assign vehicles**

### 3. Vehicles

Use Vehicles to maintain the fleet register.

- Add a vehicle and enter its vehicle and company details.
- Search by vehicle, company, or driver; optionally filter by status.
- Open a vehicle to review its details and related machine information.
- Refresh the list or clear filters to return to the full list.

The vehicle detail view provides assigned-driver information and machine
readings. Where available, authorized users can assign or remove a driver,
open a reading to review or update it, and inspect attached reading images.

**Screenshot placeholder — Vehicle list**

**Screenshot placeholder — Vehicle details, assigned drivers, and readings**

### 4. Drivers

Use Drivers to maintain driver records and find a driver by name or status.
The driver list can be refreshed, filtered, and searched. Open a driver's
details to review their information and continue to the driver's payment and
leave-management area.

**Screenshot placeholder — Driver list and driver profile**

### 5. Trip generation

Use **Trips → Treep Generator** to record a trip. A trip includes the customer,
vehicle, material, quantity in brass, and rate per brass. The page calculates
the trip value and shows a receipt preview as details are entered.

1. Select a customer and vehicle.
2. Select the material.
3. Enter quantity and rate.
4. Review the calculated trip value and receipt.
5. Select **Save trip** to save, or **Save & print** when you also need a
   printed copy.

The available customer and vehicle choices come from the operational records.
If a list is empty or unavailable, use its **Retry** action.

**Screenshot placeholder — Trip entry form**

**Screenshot placeholder — Trip receipt preview**

### 6. Billed and unbilled trips

Open **Trips → Billed Trips** to review trips marked as billed. Search the
report, refresh it, and print the report when required.

Open **Trips → Unbilled Trips** to review trips that are not yet billed. Search
the list, select eligible trips for the same customer, and choose the invoice
action. Review the invoice details, including the billed date, invoice
content, and customer, before generating the invoice. The page also provides a
printable trip report.

**Screenshot placeholder — Billed trips report**

**Screenshot placeholder — Select unbilled trips and generate an invoice**

### 7. Machine readings and AI-assisted reading entry

The **Machine Reading** menu separates **Billed Reading** from **Unbilled
Machine Reading**.

- Billed readings can be reviewed by vehicle and printed as a report.
- Unbilled readings can be searched and filtered by vehicle.
- Select eligible readings for the same customer to prepare an invoice.
- Enter the hourly rate in the invoice flow, review the selected readings and
  totals, then generate the invoice.

The web ERP's reading reports include machine, date, start/end reading, hours,
diesel, and other available reading details. The Android driver application
also supports AI-assisted reading submission as described in the mobile
section below.

**Screenshot placeholder — Billed machine-reading report**

**Screenshot placeholder — Unbilled machine readings and invoice generation**

**Screenshot placeholder — Android AI reading parser before confirmation**

**Screenshot placeholder — Android AI reading parser result and submitted reading**

### 8. Quotation Generator

Use Quotation Generator to prepare and print a customer quotation.

1. Select the customer and, optionally, a vehicle.
2. Select a material.
3. Enter its quantity, unit, and rate per unit.
4. Review the line amount, quotation total, and live document preview.
5. Repeat for other materials as needed; each material line retains its own
   quantity, unit, and rate.
6. Select **Print quotation** to print the quotation document.

Available units are Brass, Treep, KG, N, and Bags. **Clear form** resets the
quotation. The quotation screen currently supports preview and printing; it
does not save a quotation record.

**Screenshot placeholder — Quotation details and unit selection**

**Screenshot placeholder — Completed quotation preview**

### 9. Diesel Report

The Diesel Consumption Report provides a list of fuel records and summary
totals. Search or refresh the report, review vehicle, customer, pump, date,
fuel quantity, and rate information, and use **Add Diesel** to record a fuel
entry with the available vehicle and pump details.

**Screenshot placeholder — Diesel report and summary**

**Screenshot placeholder — Add diesel record**

### 10. Payments

Payment History provides a searchable view of customer payment transactions.
Review the summary and transaction list, refresh the data, and use **Add
Payment** to record a payment. Open a customer payment report for a more
detailed view of that customer's account activity.

The payment detail view groups the available machine report, dumper payment,
and payment history information. Use **Refresh** to reload the details or
**Back to Payments** to return to the payment list.

**Screenshot placeholder — Payment history and add-payment form**

**Screenshot placeholder — Customer payment details**

### 11. Driver payments and leave management

Driver Payment Management provides a driver-specific payment and leave
workspace.

- Review the driver's profile and payment summaries.
- Review payment transactions and add a driver payment.
- Apply for leave with the available leave details.
- Review leave requests in the monthly calendar and check their status.
- Authorized users can approve or reject requests; available controls also
  allow leave requests to be managed or removed.
- Move between months to review leave dates.

**Screenshot placeholder — Driver payments**

**Screenshot placeholder — Leave application and leave calendar/status**

### 12. General Vouchers

Use Voucher Management to review and search voucher records. Create a voucher
with the available driver, vehicle, date, and amount/details, then refresh the
list to confirm the record. Voucher records are also available in the
customer Portfolio when returned for that customer.

**Screenshot placeholder — Voucher list and create-voucher form**

### 13. Invoices

The Invoices page lists generated invoices, including invoice ID, billed date,
customer, and invoice content where supplied. Refresh the list and open an
invoice to view or print its document.

**Screenshot placeholder — Invoice list**

**Screenshot placeholder — Open invoice**

### 14. Customer Portfolio

Portfolio brings a selected customer's available orders, invoices, payments,
fleet information, trips, machine readings, driver payments, and vouchers into
one view.

1. Select a customer.
2. Optionally select an individual order from **Order activity**. The page
   limits activity to the selected order's order date through its delivery
   date. An order without a delivery date is treated as in process and uses
   today as the end of its range.
3. Optionally choose an activity period or custom date range.
4. Choose a section tab, search the displayed records, or filter billed and
   unbilled operational records where available.
5. Use **Export report** to download the overview or current section.

The overview includes operational KPIs such as order value, invoice count,
incoming payments, outstanding balance, diesel volume, and estimated net
profit. These financial figures are estimates based on the available records
and displayed assumptions; they should be reconciled with the organization's
accounting records before being used as formal financial statements.

**Screenshot placeholder — Customer and order activity filters**

**Screenshot placeholder — Portfolio KPI cards, charts, and activity**

### 15. Incident / Support

Use Incident / Support to log operational or application issues and follow
their progress.

- Create an incident with a title, category, priority, and description.
- Search incidents or filter them by status.
- Review incident creator, category, priority, created date, and current
  status.
- Open an incident to review its details and comment thread.
- Update its status to Open, In Progress, or Resolved where permitted.
- Add comments to the shared thread. Existing comments are displayed as
  conversation history and are not edited in place.

**Screenshot placeholder — Incident list and status filter**

**Screenshot placeholder — Incident details and comment conversation**

### 16. Account profile and chat

The account menu shows profile information returned for the signed-in account
and provides the available sign-out action.

The floating chat window can be opened and collapsed. Messages are kept in
local browser storage for the signed-in session and cleared when the user
signs out. The current assistant uses generic demo responses; live chat
integration is not available yet.

**Screenshot placeholder — Account profile menu**

**Screenshot placeholder — Collapsible chat window**

---

## Driver Android application

The Android companion app is designed for drivers and provides sign-in access
to their day-to-day work. Based on the available mobile app functionality,
drivers can:

- Sign in with their driver account.
- View their payment information.
- Apply for leave and check the leave request status.
- Submit machine readings. The reading submission flow includes an AI parser
  to assist with reading entry; drivers should review the parsed information
  before submitting.
- Submit a trip.
- Create a voucher for themselves or a vehicle.
- Review readings and trips they have submitted.
- View assigned vehicle details.
- View order details associated with the vehicle they are working on.

The exact data and actions presented to a driver depend on their account and
assigned work.

**Screenshot placeholder — Android driver sign-in**

**Screenshot placeholder — Driver home and assigned vehicle**

**Screenshot placeholder — Payment and leave status**

**Screenshot placeholder — Submit trip and view submitted trips**

**Screenshot placeholder — AI reading parser (capture 1: source/scan)**

**Screenshot placeholder — AI reading parser (capture 2: parsed values for review)**

**Screenshot placeholder — Submit voucher for driver or vehicle**

**Screenshot placeholder — Vehicle details and associated order**

---

## Suggested day-to-day workflows

### Start and track customer work

1. Add or update the customer order.
2. Assign the vehicles working on that order.
3. Record trips and machine readings as work is completed.
4. Review current activity in Trips, Machine Reading, and Portfolio.

### Prepare an invoice

1. Open the appropriate Unbilled Trips or Unbilled Machine Reading page.
2. Select eligible records for one customer.
3. Enter invoice details, including the applicable date or rate.
4. Generate the invoice and review it in Invoices.

### Keep fleet and driver operations current

1. Update vehicle and driver records.
2. Assign drivers to vehicles from vehicle details where applicable.
3. Record diesel and voucher activity.
4. Review driver payments and leave requests.

### Follow up on an operational issue

1. Create an incident and include a concise description, category, and
   priority.
2. Add comments as the issue progresses.
3. Update the status to reflect current progress or resolution.

---

## Practical tips

- Use the available search, status, date, and vehicle filters to narrow long
  lists before reviewing or printing.
- Check the selected customer and vehicle before saving operational records.
- For invoices, select records belonging to the same customer as required by
  the invoice flow.
- Review AI-parsed reading values in the Android app before submission.
- A refresh reloads data from the connected ERP services; if a list is empty,
  first confirm the selected filters and then retry.
- Keep credentials private and sign out when using a shared device.

## Feature availability note

Screens and actions depend on the signed-in account, connected services, and
permissions configured for the organization. This guide describes the web
interface and the Android driver-app capabilities supplied for this edition.
