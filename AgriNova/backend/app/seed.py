import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models import IotReading, Notification, Payment, Product, Redistribution, Shipment, User
from app.security import hash_password
from app.spoilage_ai import predict_spoilage

DEMO_USERS = [
    {
        "full_name": "Ramesh Mandal",
        "email": "farmer@smartfoodchain.ai",
        "phone": "+919800010001",
        "role": "farmer",
        "language_preference": "bn",
        "location": "Hooghly, West Bengal, India",
    },
    {
        "full_name": "Vikram Logistics Fleet",
        "email": "transporter@smartfoodchain.ai",
        "phone": "+919800010002",
        "role": "transporter",
        "language_preference": "en",
        "location": "Kolkata Hub, West Bengal, India",
    },
    {
        "full_name": "Ananya Cold Storage",
        "email": "warehouse@smartfoodchain.ai",
        "phone": "+919800010003",
        "role": "warehouse",
        "language_preference": "en",
        "location": "Siliguri Depot, West Bengal, India",
    },
    {
        "full_name": "GreenBasket Fresh Mart",
        "email": "retailer@smartfoodchain.ai",
        "phone": "+919800010004",
        "role": "retailer",
        "language_preference": "en",
        "location": "Bengaluru Central, Karnataka, India",
    },
    {
        "full_name": "Arjun Sen (System Admin)",
        "email": "admin@smartfoodchain.ai",
        "phone": "+919800010005",
        "role": "admin",
        "language_preference": "en",
        "location": "SmartFoodChain HQ, India",
    },
]


def seed_demo_users(db: Session) -> None:
    for item in DEMO_USERS:
        existing = db.query(User).filter(User.email == item["email"]).first()
        if not existing:
            user = User(
                full_name=item["full_name"],
                email=item["email"],
                phone=item["phone"],
                password_hash=hash_password("Demo@2026!"),
                role=item["role"],
                language_preference=item["language_preference"],
                theme_preference="system",
                auth_provider="email",
                location=item["location"],
                is_demo=True,
                is_active=True,
            )
            db.add(user)
    db.commit()

    farmer = db.query(User).filter(User.email == "farmer@smartfoodchain.ai").first()
    transporter = db.query(User).filter(User.email == "transporter@smartfoodchain.ai").first()
    if not farmer or db.query(Product).count() > 0:
        return

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    seed_batches = [
        ("prod-101", "BATCH-TM-101", "Desi Vine Tomatoes", "Tomato", 650, "Hooghly, West Bengal", "Kolkata Central Market", 14.0, 84.0, 0.5, 32, "/src/assets/images/farmer_mobile_harvest_1795105201987.jpg"),
        ("prod-102", "BATCH-MG-102", "Malda Himsagar Mangoes", "Mango", 420, "Malda Orchard Co-op", "Siliguri Cold Depot", 27.0, 88.0, 4.0, 78, "/src/assets/images/hero_supply_chain_1795105202293.jpg"),
        ("prod-103", "BATCH-PT-103", "Kufri Jyoti Potatoes", "Potato", 1200, "Burdwan Farm Hub", "Howrah Cold Storage", 7.0, 88.0, 0.0, 24, "/src/assets/images/cold_storage_warehouse_1795105201955.jpg"),
    ]

    for pid, bid, name, cat, qty, orig, dest, tc, hp, delay, price, img in seed_batches:
        ai = predict_spoilage(cat, tc, hp, 18.0, delay)
        db.add(
            Product(
                id=pid,
                batch_id=bid,
                farmer_id=farmer.id,
                farmer_name=farmer.full_name,
                name=name,
                category=cat,
                quantity=qty,
                unit="kg",
                harvest_date=today,
                shelf_life_days=14,
                origin=orig,
                destination=dest,
                storage_temp_c=tc,
                storage_humidity_pct=hp,
                current_temp_c=tc,
                current_humidity_pct=hp,
                transport_delay_hours=delay,
                risk_score=ai.risk_score,
                risk_level=ai.risk_level,
                explanations_json=json.dumps(ai.explanations),
                recommendations_json=json.dumps(ai.recommendations),
                listed_for_sale=True,
                price_per_unit=price,
                image_url=img,
                status="Active",
            )
        )

    db.add(
        Shipment(
            id="ship-101",
            shipment_code="SFC-2026-101",
            product_id="prod-101",
            product_name="Desi Vine Tomatoes",
            farmer_id=farmer.id,
            transporter_id=transporter.id if transporter else None,
            transporter_name=transporter.full_name if transporter else "Vikram Logistics Fleet",
            origin="Hooghly, West Bengal",
            origin_lat=22.90,
            origin_lng=88.39,
            destination="Kolkata Central Market",
            dest_lat=22.57,
            dest_lng=88.36,
            current_lat=22.74,
            current_lng=88.37,
            status="In Transit",
            current_temp_c=14.0,
            current_humidity_pct=84.0,
            delay_hours=0.5,
            eta_hours=2.5,
            risk_level="Low",
            timeline_json=json.dumps([
                {"status": "Created", "time": "06:30", "note": "Harvest logged by Ramesh Mandal"},
                {"status": "Picked Up", "time": "08:00", "note": "Cold van departed Hooghly"},
                {"status": "In Transit", "time": "10:15", "note": "Passing Dankuni Toll Plaza"},
            ]),
        )
    )
    db.add(
        Shipment(
            id="ship-102",
            shipment_code="SFC-2026-102",
            product_id="prod-102",
            product_name="Malda Himsagar Mangoes",
            farmer_id=farmer.id,
            transporter_id=transporter.id if transporter else None,
            transporter_name=transporter.full_name if transporter else "Vikram Logistics Fleet",
            origin="Malda Orchard Co-op",
            origin_lat=25.01,
            origin_lng=88.14,
            destination="Siliguri Cold Depot",
            dest_lat=26.72,
            dest_lng=88.39,
            current_lat=25.85,
            current_lng=88.25,
            status="Delayed",
            current_temp_c=27.0,
            current_humidity_pct=88.0,
            delay_hours=4.0,
            eta_hours=6.5,
            risk_level="High",
            timeline_json=json.dumps([
                {"status": "Created", "time": "05:00", "note": "Mango crates packed"},
                {"status": "Delayed", "time": "11:20", "note": "Cooling unit warning & highway jam"},
            ]),
        )
    )

    for idx, temp_val in enumerate([13.2, 13.8, 14.0, 14.4]):
        db.add(
            IotReading(
                id=f"iot-py-{idx+1}",
                shipment_id="ship-101",
                device_id="ESP32-VAN-101 (Simulated)",
                temperature_c=temp_val,
                humidity_pct=83.0 + idx * 0.5,
                recorded_at=f"10:{idx * 15:02d}",
                is_simulated=1,
            )
        )

    db.add(
        Redistribution(
            id="red-101",
            product_id="prod-102",
            product_name="Malda Himsagar Mangoes",
            quantity=120,
            unit="kg",
            location="Malda / Siliguri Corridor",
            mode="ngo",
            ngo_name="Annapurna Food Rescue (Demo NGO)",
            discount_pct=50,
            status="Available",
            requested_by="AI Spoilage Alert",
        )
    )

    db.add(
        Notification(
            id="notif-101",
            role_target="all",
            title="High Spoilage Alert: SFC-2026-102",
            message="Malda Himsagar Mangoes reached 27°C with a 4h delay. Consider NGO rescue or immediate cold depot transfer.",
            severity="critical",
        )
    )

    db.add(
        Payment(
            id="pay-101",
            farmer_id=farmer.id,
            product_name="Desi Vine Tomatoes (650 kg)",
            amount_inr=20800,
            status="Paid",
            buyer_name="GreenBasket Fresh Mart",
            created_at=today,
        )
    )
    db.add(
        Payment(
            id="pay-102",
            farmer_id=farmer.id,
            product_name="Kufri Jyoti Potatoes (1200 kg)",
            amount_inr=28800,
            status="Pending",
            buyer_name="Howrah Cold Storage",
            created_at=today,
        )
    )

    db.commit()
