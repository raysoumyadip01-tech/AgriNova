import json
import random
import urllib.request
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import (
    IotReading,
    Notification,
    Payment,
    Product,
    Redistribution,
    Shipment,
    SupportTicket,
    User,
    new_uuid,
)
from app.security import get_current_user
from app.spoilage_ai import predict_spoilage

router = APIRouter(prefix="/api", tags=["Supply Chain Operations"])


class ProductCreate(BaseModel):
    name: str
    category: str = "Tomato"
    quantity: float = 100
    unit: str = "kg"
    harvest_date: Optional[str] = None
    origin: Optional[str] = None
    destination: str = "Kolkata Central Market"
    current_temp_c: float = 14.0
    current_humidity_pct: float = 84.0
    listed_for_sale: bool = True
    price_per_unit: float = 32.0
    image_url: str = "/src/assets/images/farmer_mobile_harvest_1795105201987.jpg"


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[float] = None
    current_temp_c: Optional[float] = None
    current_humidity_pct: Optional[float] = None
    transport_delay_hours: Optional[float] = None
    listed_for_sale: Optional[bool] = None
    price_per_unit: Optional[float] = None
    status: Optional[str] = None


class ShipmentCreate(BaseModel):
    product_id: str
    destination: Optional[str] = None
    transporter_name: Optional[str] = None
    current_temp_c: Optional[float] = None
    current_humidity_pct: Optional[float] = None


class ShipmentUpdate(BaseModel):
    status: Optional[str] = None
    current_temp_c: Optional[float] = None
    current_humidity_pct: Optional[float] = None
    delay_hours: Optional[float] = None
    note: Optional[str] = None
    advance_gps: bool = False


class SpoilageRequest(BaseModel):
    category: str = "Tomato"
    temperature_c: float = 15.0
    humidity_pct: float = 82.0
    storage_hours: float = 12.0
    transport_delay_hours: float = 0.0


class IotSimRequest(BaseModel):
    shipment_id: str
    temperature_c: Optional[float] = None
    humidity_pct: Optional[float] = None


class RedistributionCreate(BaseModel):
    product_id: str
    mode: str = "ngo"
    ngo_name: str = "Annapurna Food Rescue (Demo NGO)"
    discount_pct: int = 40


class RedistributionStatusUpdate(BaseModel):
    status: str


class TicketCreate(BaseModel):
    subject: str
    message: str


def _serialize_product(p: Product) -> dict:
    return {
        "id": p.id,
        "batch_id": p.batch_id,
        "farmer_id": p.farmer_id,
        "farmer_name": p.farmer_name,
        "name": p.name,
        "category": p.category,
        "quantity": p.quantity,
        "unit": p.unit,
        "harvest_date": p.harvest_date,
        "shelf_life_days": p.shelf_life_days,
        "origin": p.origin,
        "destination": p.destination,
        "storage_temp_c": p.storage_temp_c,
        "storage_humidity_pct": p.storage_humidity_pct,
        "current_temp_c": p.current_temp_c,
        "current_humidity_pct": p.current_humidity_pct,
        "transport_delay_hours": p.transport_delay_hours,
        "risk_score": p.risk_score,
        "risk_level": p.risk_level,
        "explanations": json.loads(p.explanations_json or "[]"),
        "recommendations": json.loads(p.recommendations_json or "[]"),
        "listed_for_sale": bool(p.listed_for_sale),
        "price_per_unit": p.price_per_unit,
        "image_url": p.image_url,
        "status": p.status,
        "created_at": p.created_at.isoformat() if p.created_at else "",
    }


def _serialize_shipment(s: Shipment) -> dict:
    return {
        "id": s.id,
        "shipment_code": s.shipment_code,
        "product_id": s.product_id,
        "product_name": s.product_name,
        "farmer_id": s.farmer_id,
        "transporter_id": s.transporter_id,
        "transporter_name": s.transporter_name,
        "origin": s.origin,
        "origin_lat": s.origin_lat,
        "origin_lng": s.origin_lng,
        "destination": s.destination,
        "dest_lat": s.dest_lat,
        "dest_lng": s.dest_lng,
        "current_lat": s.current_lat,
        "current_lng": s.current_lng,
        "status": s.status,
        "current_temp_c": s.current_temp_c,
        "current_humidity_pct": s.current_humidity_pct,
        "delay_hours": s.delay_hours,
        "eta_hours": s.eta_hours,
        "risk_level": s.risk_level,
        "timeline": json.loads(s.timeline_json or "[]"),
        "created_at": s.created_at.isoformat() if s.created_at else "",
        "updated_at": s.updated_at.isoformat() if s.updated_at else "",
    }


@router.get("/products")
def list_products(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Product).order_by(Product.created_at.desc()).all()
    return [_serialize_product(r) for r in rows]


@router.post("/products", status_code=201)
def create_product(payload: ProductCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ai = predict_spoilage(payload.category, payload.current_temp_c, payload.current_humidity_pct, 6.0, 0.0)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    batch_code = f"BATCH-{payload.category[:2].upper()}-{random.randint(200, 999)}"
    prod = Product(
        id=f"prod-{new_uuid()[:8]}",
        batch_id=batch_code,
        farmer_id=current_user.id,
        farmer_name=current_user.full_name,
        name=payload.name,
        category=payload.category,
        quantity=payload.quantity,
        unit=payload.unit,
        harvest_date=payload.harvest_date or today,
        origin=payload.origin or current_user.location or "Hooghly, West Bengal",
        destination=payload.destination,
        storage_temp_c=payload.current_temp_c,
        storage_humidity_pct=payload.current_humidity_pct,
        current_temp_c=payload.current_temp_c,
        current_humidity_pct=payload.current_humidity_pct,
        risk_score=ai.risk_score,
        risk_level=ai.risk_level,
        explanations_json=json.dumps(ai.explanations),
        recommendations_json=json.dumps(ai.recommendations),
        listed_for_sale=payload.listed_for_sale,
        price_per_unit=payload.price_per_unit,
        image_url=payload.image_url,
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    return _serialize_product(prod)


@router.put("/products/{product_id}")
def update_product(product_id: str, payload: ProductUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product batch not found.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prod, field, value)

    ai = predict_spoilage(
        prod.category,
        prod.current_temp_c,
        prod.current_humidity_pct,
        18.0,
        prod.transport_delay_hours,
    )
    prod.risk_score = ai.risk_score
    prod.risk_level = ai.risk_level
    prod.explanations_json = json.dumps(ai.explanations)
    prod.recommendations_json = json.dumps(ai.recommendations)
    db.commit()
    db.refresh(prod)
    return _serialize_product(prod)


@router.delete("/products/{product_id}")
def delete_product(product_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product batch not found.")
    db.delete(prod)
    db.commit()
    return {"message": "Product batch deleted."}


@router.get("/shipments")
def list_shipments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Shipment).order_by(Shipment.created_at.desc()).all()
    return [_serialize_shipment(r) for r in rows]


@router.get("/shipments/lookup/{code}")
def lookup_shipment(code: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ship = db.query(Shipment).filter(Shipment.shipment_code.ilike(code.strip())).first()
    if not ship:
        raise HTTPException(status_code=404, detail=f"Shipment '{code}' not found.")
    prod = db.query(Product).filter(Product.id == ship.product_id).first()
    return {"shipment": _serialize_shipment(ship), "product": _serialize_product(prod) if prod else None}


@router.post("/shipments", status_code=201)
def create_shipment(payload: ShipmentCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == payload.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product batch not found.")
    code = f"SFC-2026-{random.randint(200, 999)}"
    now_hm = datetime.now(timezone.utc).strftime("%H:%M")
    ship = Shipment(
        id=f"ship-{new_uuid()[:8]}",
        shipment_code=code,
        product_id=prod.id,
        product_name=prod.name,
        farmer_id=prod.farmer_id,
        transporter_id=current_user.id if current_user.role == "transporter" else None,
        transporter_name=payload.transporter_name or "Vikram Logistics Fleet",
        origin=prod.origin,
        destination=payload.destination or prod.destination,
        current_temp_c=payload.current_temp_c if payload.current_temp_c is not None else prod.current_temp_c,
        current_humidity_pct=payload.current_humidity_pct if payload.current_humidity_pct is not None else prod.current_humidity_pct,
        risk_level=prod.risk_level,
        timeline_json=json.dumps([{"status": "Created", "time": now_hm, "note": f"Dispatched by {current_user.full_name}"}]),
    )
    db.add(ship)
    db.commit()
    db.refresh(ship)
    return _serialize_shipment(ship)


@router.put("/shipments/{shipment_id}/update")
def update_shipment(shipment_id: str, payload: ShipmentUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ship = db.query(Shipment).filter(Shipment.id == shipment_id).first()
    if not ship:
        raise HTTPException(status_code=404, detail="Shipment not found.")

    if payload.status:
        ship.status = payload.status
    if payload.current_temp_c is not None:
        ship.current_temp_c = payload.current_temp_c
    if payload.current_humidity_pct is not None:
        ship.current_humidity_pct = payload.current_humidity_pct
    if payload.delay_hours is not None:
        ship.delay_hours = payload.delay_hours
    if payload.advance_gps:
        ship.current_lat = round(ship.current_lat + (ship.dest_lat - ship.current_lat) * 0.25, 4)
        ship.current_lng = round(ship.current_lng + (ship.dest_lng - ship.current_lng) * 0.25, 4)

    prod = db.query(Product).filter(Product.id == ship.product_id).first()
    category = prod.category if prod else "Tomato"
    ai = predict_spoilage(category, ship.current_temp_c, ship.current_humidity_pct, 16.0, ship.delay_hours)
    ship.risk_level = ai.risk_level

    timeline = json.loads(ship.timeline_json or "[]")
    timeline.append({
        "status": ship.status,
        "time": datetime.now(timezone.utc).strftime("%H:%M"),
        "note": payload.note or f"Updated by {current_user.full_name} ({ship.current_temp_c}°C)",
    })
    ship.timeline_json = json.dumps(timeline)
    db.commit()
    db.refresh(ship)
    return _serialize_shipment(ship)


@router.post("/ai/predict-spoilage")
def api_predict_spoilage(payload: SpoilageRequest, current_user: User = Depends(get_current_user)):
    res = predict_spoilage(
        payload.category,
        payload.temperature_c,
        payload.humidity_pct,
        payload.storage_hours,
        payload.transport_delay_hours,
    )
    return {
        "risk_score": res.risk_score,
        "risk_level": res.risk_level,
        "explanations": res.explanations,
        "recommendations": res.recommendations,
        "model_note": res.model_note,
    }


@router.get("/iot/readings")
def list_iot_readings(shipment_id: str = Query(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(IotReading).filter(IotReading.shipment_id == shipment_id).all()
    return [
        {
            "id": r.id,
            "shipment_id": r.shipment_id,
            "device_id": r.device_id,
            "temperature_c": r.temperature_c,
            "humidity_pct": r.humidity_pct,
            "recorded_at": r.recorded_at,
            "is_simulated": r.is_simulated,
        }
        for r in rows
    ]


@router.post("/iot/simulate", status_code=201)
def simulate_iot(payload: IotSimRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    temp = payload.temperature_c if payload.temperature_c is not None else round(12.0 + random.uniform(0, 14), 1)
    hum = payload.humidity_pct if payload.humidity_pct is not None else round(76.0 + random.uniform(0, 14), 1)
    reading = IotReading(
        id=f"iot-{new_uuid()[:8]}",
        shipment_id=payload.shipment_id,
        device_id="ESP32-SIM-NODE (Simulated)",
        temperature_c=temp,
        humidity_pct=hum,
        recorded_at=datetime.now(timezone.utc).strftime("%H:%M:%S"),
        is_simulated=1,
    )
    db.add(reading)
    db.commit()
    return {
        "id": reading.id,
        "shipment_id": reading.shipment_id,
        "device_id": reading.device_id,
        "temperature_c": reading.temperature_c,
        "humidity_pct": reading.humidity_pct,
        "recorded_at": reading.recorded_at,
        "is_simulated": reading.is_simulated,
    }


@router.get("/redistributions")
def list_redistributions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Redistribution).order_by(Redistribution.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "product_id": r.product_id,
            "product_name": r.product_name,
            "quantity": r.quantity,
            "unit": r.unit,
            "location": r.location,
            "mode": r.mode,
            "ngo_name": r.ngo_name,
            "discount_pct": r.discount_pct,
            "status": r.status,
            "requested_by": r.requested_by,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]


@router.post("/redistributions", status_code=201)
def create_redistribution(payload: RedistributionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == payload.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found.")
    item = Redistribution(
        id=f"red-{new_uuid()[:8]}",
        product_id=prod.id,
        product_name=prod.name,
        quantity=prod.quantity,
        unit=prod.unit,
        location=prod.origin,
        mode=payload.mode,
        ngo_name=payload.ngo_name,
        discount_pct=payload.discount_pct,
        status="Available",
        requested_by=current_user.full_name,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "product_id": item.product_id,
        "product_name": item.product_name,
        "quantity": item.quantity,
        "unit": item.unit,
        "location": item.location,
        "mode": item.mode,
        "ngo_name": item.ngo_name,
        "discount_pct": item.discount_pct,
        "status": item.status,
        "requested_by": item.requested_by,
        "created_at": item.created_at.isoformat() if item.created_at else "",
    }


@router.put("/redistributions/{red_id}/status")
def update_redistribution_status(red_id: str, payload: RedistributionStatusUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(Redistribution).filter(Redistribution.id == red_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Redistribution listing not found.")
    item.status = payload.status
    db.commit()
    return {
        "id": item.id,
        "product_id": item.product_id,
        "product_name": item.product_name,
        "quantity": item.quantity,
        "unit": item.unit,
        "location": item.location,
        "mode": item.mode,
        "ngo_name": item.ngo_name,
        "discount_pct": item.discount_pct,
        "status": item.status,
        "requested_by": item.requested_by,
        "created_at": item.created_at.isoformat() if item.created_at else "",
    }


@router.get("/payments")
def list_payments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Payment).all()
    return [
        {
            "id": p.id,
            "farmer_id": p.farmer_id,
            "product_name": p.product_name,
            "amount_inr": p.amount_inr,
            "status": p.status,
            "buyer_name": p.buyer_name,
            "created_at": p.created_at,
        }
        for p in rows
    ]


@router.put("/payments/{payment_id}/settle")
def settle_payment(payment_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role not in {"admin", "retailer"}:
        raise HTTPException(status_code=403, detail="Only retailers or admins can settle farmer payments.")
    pay = db.query(Payment).filter(Payment.id == payment_id).first()
    if not pay:
        raise HTTPException(status_code=404, detail="Payment record not found.")
    pay.status = "Paid"
    db.commit()
    db.refresh(pay)
    return {
        "id": pay.id,
        "farmer_id": pay.farmer_id,
        "product_name": pay.product_name,
        "amount_inr": pay.amount_inr,
        "status": pay.status,
        "buyer_name": pay.buyer_name,
        "created_at": pay.created_at,
    }


@router.get("/notifications")
def list_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(Notification).order_by(Notification.created_at.desc()).all()
    return [
        {
            "id": n.id,
            "user_id": n.user_id,
            "role_target": n.role_target,
            "title": n.title,
            "message": n.message,
            "severity": n.severity,
            "is_read": bool(n.is_read),
            "created_at": n.created_at.isoformat() if n.created_at else "",
        }
        for n in rows
    ]


@router.put("/notifications/read-all")
def read_all_notifications(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).update({Notification.is_read: True})
    db.commit()
    return {"message": "All notifications marked read."}


@router.delete("/notifications/{notif_id}")
def delete_notification(notif_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.query(Notification).filter(Notification.id == notif_id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")
    db.delete(n)
    db.commit()
    return {"message": "Notification deleted."}


@router.get("/tickets")
def list_tickets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.query(SupportTicket).order_by(SupportTicket.created_at.desc()).all()
    return [
        {
            "id": t.id,
            "user_id": t.user_id,
            "user_name": t.user_name,
            "role": t.role,
            "subject": t.subject,
            "message": t.message,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else "",
        }
        for t in rows
    ]


@router.post("/tickets", status_code=201)
def create_ticket(payload: TicketCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    tkt = SupportTicket(
        id=f"TKT-{random.randint(1000, 9999)}",
        user_id=current_user.id,
        user_name=current_user.full_name,
        role=current_user.role,
        subject=payload.subject,
        message=payload.message,
        status="Open",
    )
    db.add(tkt)
    db.commit()
    db.refresh(tkt)
    return {
        "id": tkt.id,
        "user_id": tkt.user_id,
        "user_name": tkt.user_name,
        "role": tkt.role,
        "subject": tkt.subject,
        "message": tkt.message,
        "status": tkt.status,
        "created_at": tkt.created_at.isoformat() if tkt.created_at else "",
    }


@router.get("/weather")
def get_weather(lat: float = 22.57, lng: float = 88.36, current_user: User = Depends(get_current_user)):
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lng}&current=temperature_2m,relative_humidity_2m,weather_code"
    try:
        with urllib.request.urlopen(url, timeout=4) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        cur = data.get("current", {})
        return {
            "source": "Open-Meteo Live API",
            "latitude": lat,
            "longitude": lng,
            "temperature_c": cur.get("temperature_2m", 28.4),
            "humidity_pct": cur.get("relative_humidity_2m", 72),
            "weather_code": cur.get("weather_code", 1),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception:
        return {
            "source": "Simulated Weather Fallback (Offline)",
            "latitude": lat,
            "longitude": lng,
            "temperature_c": 29.0,
            "humidity_pct": 74,
            "weather_code": 1,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
